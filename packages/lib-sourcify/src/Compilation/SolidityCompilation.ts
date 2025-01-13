import { AuxdataStyle, splitAuxdata } from '@ethereum-sourcify/bytecode-utils';
import { logWarn } from '../lib/logger';
import { AbstractCompilation } from './AbstractCompilation';
import {
  ImmutableReferences,
  ISolidityCompiler,
  SolidityJsonInput,
  SolidityOutput,
  SolidityOutputContract,
} from './SolidityTypes';
import {
  AuxdataDiff,
  CompilationTarget,
  CompiledContractCborAuxdata,
} from './CompilationTypes';

/**
 * Abstraction of a solidity compilation
 */
export class SolidityCompilation extends AbstractCompilation {
  // Use declare to override AbstractCompilation's types to target Solidity types
  declare compilerOutput?: SolidityOutput;
  declare compileAndReturnCompilationTarget: (
    forceEmscripten: boolean,
  ) => Promise<SolidityOutputContract>;
  declare getCompilationTarget: () => SolidityOutputContract;

  // Specify the auxdata style, used for extracting the auxdata from the compiler output
  readonly auxdataStyle: AuxdataStyle.SOLIDITY = AuxdataStyle.SOLIDITY;

  public constructor(
    public compiler: ISolidityCompiler,
    public compilerVersion: string,
    public jsonInput: SolidityJsonInput,
    public compilationTarget: CompilationTarget,
  ) {
    super();
    this.initSolidityJsonInput();
  }

  initSolidityJsonInput() {
    this.jsonInput.settings.outputSelection = {
      '*': {
        '*': [
          'abi',
          'devdoc',
          'userdoc',
          'storageLayout',
          'evm.legacyAssembly',
          'evm.bytecode.object',
          'evm.bytecode.sourceMap',
          'evm.bytecode.linkReferences',
          'evm.bytecode.generatedSources',
          'evm.deployedBytecode.object',
          'evm.deployedBytecode.sourceMap',
          'evm.deployedBytecode.linkReferences',
          'evm.deployedBytecode.immutableReferences',
          'metadata',
        ],
      },
    };
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
    // Auxdata array extracted from the compiler's `legacyAssembly` field
    const auxdatasFromCompilerOutput = findAuxdatasInLegacyAssembly(
      this.getCompilationTarget().evm.legacyAssembly,
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
        this.getRuntimeBytecode(),
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
            this.getRuntimeBytecode().substring(2).length / 2 -
            parseInt(runtimeCborLengthHex, 16) -
            2, // bytecode has 2 bytes of cbor length prefix at the end
          value: `0x${auxdataFromRawRuntimeBytecode}`,
        },
      };

      // Try to extract the auxdata from the end of the recompiled creation bytecode
      const [, creationAuxdataCbor, creationCborLengthHex] = splitAuxdata(
        this.getCreationBytecode(),
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
                this.getCreationBytecode().substring(2).length / 2 -
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
        `0x${this.getRuntimeBytecode()}`,
        `0x${editedContract?.evm?.deployedBytecode?.object}`,
        auxdatasFromCompilerOutput,
        editedContractAuxdatasFromCompilerOutput,
      );
    }

    this.creationBytecodeCborAuxdata = findAuxdataPositions(
      `0x${this.getCreationBytecode()}`,
      `0x${editedContract?.evm.bytecode.object}`,
      auxdatasFromCompilerOutput,
      editedContractAuxdatasFromCompilerOutput,
    );

    return true;
  }

  public async compile(forceEmscripten = false) {
    const contract =
      await this.compileAndReturnCompilationTarget(forceEmscripten);
    // Store the metadata from the compiler output and replace the initial user provided one.
    // Because the compiler output metadata is the one corresponding to the CBOR auxdata and the user might have provided a modified one e.g. the userdoc,abi fields modified which don't affect the compilation.
    this.metadata = JSON.parse(contract.metadata.trim());
  }

  getImmutableReferences(): ImmutableReferences {
    return (
      this.getCompilationTarget().evm.deployedBytecode.immutableReferences || {}
    );
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
