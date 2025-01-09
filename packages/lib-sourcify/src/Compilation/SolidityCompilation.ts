import { AuxdataStyle, splitAuxdata } from '@ethereum-sourcify/bytecode-utils';
import { logInfo, logSilly, logWarn } from '../lib/logger';
import { AbstractCompilation } from './AbstractCompilation';
import {
  ISolidityCompiler,
  SolidityJsonInput,
  SolidityOutput,
} from './SolidityTypes';
import {
  AuxdataDiff,
  CompilationTarget,
  CompiledContractCborAuxdata,
  RecompilationResult,
} from './CompilationTypes';

/**
 * Abstraction of a solidity compilation
 */
export class SolidityCompilation extends AbstractCompilation {
  // Use declare to specify the type of compilerOutput
  declare compilerOutput?: SolidityOutput;

  // Specify the auxdata style, used for extracting the auxdata from the compiler output
  readonly auxdataStyle: AuxdataStyle.SOLIDITY = AuxdataStyle.SOLIDITY;

  public constructor(
    public compiler: ISolidityCompiler,
    public compilerVersion: string,
    public jsonInput: SolidityJsonInput,
    public compilationTarget: CompilationTarget,
  ) {
    super();
  }

  /** Generates an edited contract with a space at the end of each source file to create a different source file hash and consequently a different metadata hash.
   * This differenence is then used to determine the positions of the auxdata in the raw bytecode.
   */
  public async generateEditedContract(compilerSettings: {
    version: string;
    solcJsonInput: SolidityJsonInput;
    forceEmscripten: boolean;
  }) {
    const newCompilerSettings: {
      version: string;
      solcJsonInput: SolidityJsonInput;
      forceEmscripten: boolean;
    } = JSON.parse(JSON.stringify(compilerSettings));
    Object.values(newCompilerSettings.solcJsonInput.sources).forEach(
      (source) => (source.content += ' '),
    );
    return await this.compiler.compile(
      newCompilerSettings.version,
      newCompilerSettings.solcJsonInput,
      newCompilerSettings.forceEmscripten,
    );
  }

  /**
   * Finds the positions of the auxdata in the runtime and creation bytecodes.
   * Saves the CborAuxdata position (offset) and value in the runtime- and creationBytecodeCborAuxdata fields.
   * @returns false if the auxdata positions cannot be generated or if the auxdata in legacyAssembly differs from the auxdata in the bytecode, true otherwise.
   */
  public async generateCborAuxdataPositions(forceEmscripten = false) {
    if (
      !this.creationBytecode ||
      !this.runtimeBytecode ||
      !this.compilerOutput
    ) {
      return false;
    }

    // Auxdata array extracted from the compiler's `legacyAssembly` field
    const auxdatasFromCompilerOutput = findAuxdatasInLegacyAssembly(
      this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ].evm.legacyAssembly,
    );

    // Case: there is not auxadata
    if (auxdatasFromCompilerOutput.length === 0) {
      this.creationBytecodeCborAuxdata = {};
      this.runtimeBytecodeCborAuxdata = {};
      return true;
    }

    // Case: there is only one auxdata, no need to recompile
    if (auxdatasFromCompilerOutput.length === 1) {
      // Extract the auxdata from the end of the recompiled runtime bytecode
      const [, runtimeAuxdataCbor, runtimeCborLengthHex] = splitAuxdata(
        this.runtimeBytecode,
        this.auxdataStyle,
      );

      const auxdataFromRawRuntimeBytecode = `${runtimeAuxdataCbor}${runtimeCborLengthHex}`;

      // For some reason the auxdata from raw bytecode differs from the legacyAssembly's auxdata
      if (auxdatasFromCompilerOutput[0] !== auxdataFromRawRuntimeBytecode) {
        logWarn(
          "The auxdata from raw bytecode differs from the legacyAssembly's auxdata",
          {
            name: this.compilationTarget.name,
          },
        );
        return false;
      }

      // we divide by 2 because we store the length in bytes (without 0x)
      this.runtimeBytecodeCborAuxdata = {
        '1': {
          offset:
            this.runtimeBytecode.substring(2).length / 2 -
            parseInt(runtimeCborLengthHex, 16) -
            2, // bytecode has 2 bytes of cbor length prefix at the end
          value: `0x${auxdataFromRawRuntimeBytecode}`,
        },
      };

      // Try to extract the auxdata from the end of the recompiled creation bytecode
      const [, creationAuxdataCbor, creationCborLengthHex] = splitAuxdata(
        this.creationBytecode,
        this.auxdataStyle,
      );

      // If we can find the auxdata at the end of the bytecode return; otherwise continue with `generateEditedContract`
      if (creationAuxdataCbor) {
        const auxdataFromRawCreationBytecode = `${creationAuxdataCbor}${creationCborLengthHex}`;
        if (auxdatasFromCompilerOutput[0] === auxdataFromRawCreationBytecode) {
          // we divide by 2 because we store the length in bytes (without 0x)
          this.creationBytecodeCborAuxdata = {
            '1': {
              offset:
                this.creationBytecode.substring(2).length / 2 -
                parseInt(creationCborLengthHex, 16) -
                2, // bytecode has 2 bytes of cbor length prefix at the end
              value: `0x${auxdataFromRawCreationBytecode}`,
            },
          };
          return true;
        } else {
          logWarn(
            "The creation auxdata from raw bytecode differs from the legacyAssembly's auxdata",
            { name: this.compilationTarget.name },
          );
        }
      }
    }

    // Case: multiple auxdatas or failing creation auxdata,
    // we need to recompile with a slightly edited file to check the differences
    const editedContractCompilerOutput = await this.generateEditedContract({
      version: this.compilerVersion,
      solcJsonInput: this.jsonInput,
      forceEmscripten,
    });
    const editedContract =
      editedContractCompilerOutput?.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ];

    const editedContractAuxdatasFromCompilerOutput =
      findAuxdatasInLegacyAssembly(editedContract.evm.legacyAssembly);

    // Potentially we already found runtimeBytecodeCborAuxdata in the case of failing creation auxdata
    // so no need to call `findAuxdataPositions`
    if (this.runtimeBytecodeCborAuxdata === undefined) {
      this.runtimeBytecodeCborAuxdata = findAuxdataPositions(
        this.runtimeBytecode,
        `0x${editedContract?.evm?.deployedBytecode?.object}`,
        auxdatasFromCompilerOutput,
        editedContractAuxdatasFromCompilerOutput,
      );
    }

    this.creationBytecodeCborAuxdata = findAuxdataPositions(
      this.creationBytecode,
      `0x${editedContract?.evm.bytecode.object}`,
      auxdatasFromCompilerOutput,
      editedContractAuxdatasFromCompilerOutput,
    );

    return true;
  }

  public async recompile(
    forceEmscripten = false,
  ): Promise<RecompilationResult> {
    const version = this.compilerVersion;

    const compilationStartTime = Date.now();
    logInfo('Compiling contract', {
      version,
      contract: this.compilationTarget.name,
      path: this.compilationTarget.path,
      forceEmscripten,
    });
    logSilly('Compilation input', { solcJsonInput: this.jsonInput });
    this.compilerOutput = await this.compiler.compile(
      version,
      this.jsonInput,
      forceEmscripten,
    );
    if (this.compilerOutput === undefined) {
      const error = new Error('Compiler error');
      logWarn('Compiler error', {
        errorMessages: ['compilerOutput is undefined'],
      });
      throw error;
    }

    const compilationEndTime = Date.now();
    const compilationDuration = compilationEndTime - compilationStartTime;
    logSilly('Compilation output', { compilerOutput: this.compilerOutput });
    logInfo('Compiled contract', {
      version,
      contract: this.compilationTarget.name,
      path: this.compilationTarget.path,
      forceEmscripten,
      compilationDuration: `${compilationDuration}ms`,
    });

    if (
      !this.compilerOutput.contracts ||
      !this.compilerOutput.contracts[this.compilationTarget.path] ||
      !this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ] ||
      !this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ].evm ||
      !this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ].evm.bytecode
    ) {
      const errorMessages =
        this.compilerOutput.errors
          ?.filter((e: any) => e.severity === 'error')
          .map((e: any) => e.formattedMessage) || [];

      const error = new Error('Compiler error');
      logWarn('Compiler error', {
        errorMessages,
      });
      throw error;
    }

    const contract =
      this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ];

    this.creationBytecode = `0x${contract.evm.bytecode.object}`;
    this.runtimeBytecode = `0x${contract.evm?.deployedBytecode?.object}`;

    // Store the metadata from the compiler output and replace the initial user provided one.
    // Because the compiler output metadata is the one corresponding to the CBOR auxdata and the user might have provided a modified one e.g. the userdoc,abi fields modified which don't affect the compilation.
    this.metadataRaw = contract.metadata.trim();
    this.metadata = JSON.parse(this.metadataRaw);

    return {
      creationBytecode: this.creationBytecode,
      runtimeBytecode: this.runtimeBytecode,
      metadata: this.metadataRaw,
      // Sometimes the compiler returns empty object (not falsey). Convert it to undefined (falsey).
      immutableReferences:
        contract.evm?.deployedBytecode?.immutableReferences || {},
      creationLinkReferences: contract?.evm?.bytecode?.linkReferences || {},
      runtimeLinkReferences:
        contract?.evm?.deployedBytecode?.linkReferences || {},
    };
  }
}

function getAuxdataInLegacyAssemblyBranch(
  legacyAssemblyBranch: any,
  auxdatas: string[],
) {
  if (typeof legacyAssemblyBranch === 'object') {
    Object.keys(legacyAssemblyBranch).forEach((key) => {
      switch (key) {
        case '.auxdata': {
          auxdatas.push(legacyAssemblyBranch[key]);
          break;
        }
        case '.code': {
          break;
        }
        default: {
          if (key === '.data' || Number.isInteger(Number(key))) {
            return getAuxdataInLegacyAssemblyBranch(
              legacyAssemblyBranch[key],
              auxdatas,
            );
          }
        }
      }
    });
  }
}

function findAuxdatasInLegacyAssembly(legacyAssembly: any) {
  const auxdatas: string[] = [];
  getAuxdataInLegacyAssemblyBranch(legacyAssembly, auxdatas);
  return auxdatas;
}

/**
 * Given two bytecodes, this function returns an array of ALL differing indexes.
 * @example getDiffPositions(['A', 'b', 'c', 'A', 'd'], ['A', 'x', 'y', 'A', 'z']) => [1, 2, 4]
 *
 */
function getDiffPositions(original: string, modified: string): number[] {
  const differences: number[] = [];
  const minLength = Math.min(original.length, modified.length);

  for (let i = 0; i < minLength; i++) {
    if (original[i] !== modified[i]) {
      differences.push(i);
    }
  }

  return differences;
}

/**
 *   Checks the raw bytecode indeed includes the auxdata diff at the given position
 */
function bytecodeIncludesAuxdataDiffAt(
  bytecode: string,
  auxdataDiff: AuxdataDiff,
  position: number,
): boolean {
  const { real, diffStart } = auxdataDiff;
  // the difference (i.e metadata hash) starts from "position". To get the whole auxdata instead of metadata go back "diffStart" and until + "real.length" of the auxdata.
  const extracted = bytecode.slice(
    position - diffStart,
    position - diffStart + real.length,
  );
  return extracted === real;
}

function getAuxdatasDiff(originalAuxdatas: string[], editedAuxdatas: string[]) {
  const auxdataDiffs: AuxdataDiff[] = [];
  for (let i = 0; i < originalAuxdatas.length; i++) {
    const diffPositions = getDiffPositions(
      originalAuxdatas[i],
      editedAuxdatas[i],
    );
    auxdataDiffs.push({
      real: originalAuxdatas[i],
      diffStart: diffPositions[0],
      diff: originalAuxdatas[i].substring(
        diffPositions[0],
        diffPositions[diffPositions.length - 1] + 1,
      ),
    });
  }
  return auxdataDiffs;
}

/**
 * Finds the positions of the auxdata in the bytecode.
 * The compiler outputs the auxdata values in the `legacyAssembly` field. However we can't use these values to do a simple string search on the compiled bytecode because an attacker can embed these values in the compiled contract code and cause the correspoding field in the onchain bytecode to be ignored falsely during verification.
 * A way to find the *metadata hashes* in the bytecode is to recompile the contract with a slightly edited source code and compare the differences in the raw bytecodes. However, this will only give us the positions of the metadata hashes in the bytecode. We need to find the positions of the whole *auxdata* in the bytecode.
 * So we go through each of the differences in the raw bytecode and check if an auxdata diff value from the legacyAssembly is included in that difference. If it is, we have found the position of the auxdata in the bytecode.
 */
function findAuxdataPositions(
  originalBytecode: string,
  editedBytecode: string,
  originalAuxdatas: string[],
  editedAuxdatas: string[],
): CompiledContractCborAuxdata {
  const auxdataDiffObjects = getAuxdatasDiff(originalAuxdatas, editedAuxdatas);

  const diffPositionsBytecodes = getDiffPositions(
    originalBytecode,
    editedBytecode,
  );
  const auxdataPositions: CompiledContractCborAuxdata = {};

  let prevDiffPosition = -99;
  for (const diffPosition of diffPositionsBytecodes) {
    // Don't check consecutive diffs like 55, 56, 57... , only if there's a gap like 55, 57, 58, then 78, 79, 80...
    if (prevDiffPosition + 1 === diffPosition) {
      prevDiffPosition = diffPosition;
      continue;
    }
    // New diff position
    for (const auxdataDiffIndex in auxdataDiffObjects) {
      const auxdataPositionsIndex = parseInt(auxdataDiffIndex) + 1;
      if (
        auxdataPositions[auxdataPositionsIndex] === undefined &&
        bytecodeIncludesAuxdataDiffAt(
          originalBytecode,
          auxdataDiffObjects[auxdataDiffIndex],
          diffPosition,
        )
      ) {
        auxdataPositions[auxdataPositionsIndex] = {
          offset:
            (diffPosition -
              auxdataDiffObjects[auxdataDiffIndex].diffStart -
              2) /
            2,
          value: `0x${auxdataDiffObjects[auxdataDiffIndex].real}`,
        };
      }
    }
    prevDiffPosition = diffPosition;
  }

  return auxdataPositions;
}
