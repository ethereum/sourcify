import { logError, logWarn } from '../lib/logger';
import { AbstractCompilation } from './AbstractCompilation';
import { id } from 'ethers';
import {
  AuxdataStyle,
  decode,
  splitAuxdata,
} from '@ethereum-sourcify/bytecode-utils';
import semver, { gte } from 'semver';
import {
  IVyperCompiler,
  VyperJsonInput,
  VyperOutput,
  VyperOutputContract,
} from './VyperTypes';
import {
  CompilationTarget,
  CompiledContractCborAuxdata,
  MetadataOutput,
  RecompilationResult,
} from './CompilationTypes';
import { ImmutableReferences } from './SolidityTypes';

/**
 * Abstraction of a checked vyper contract. With metadata and source (vyper) files.
 */
export class VyperCompilation extends AbstractCompilation {
  // Use declare to override AbstractCompilation's types to target Solidity types
  declare compilerOutput?: VyperOutput;
  declare recompileAndReturnContract: (
    forceEmscripten: boolean,
  ) => Promise<VyperOutputContract>;

  // Specify the auxdata style, used for extracting the auxdata from the compiler output
  public auxdataStyle:
    | AuxdataStyle.VYPER
    | AuxdataStyle.VYPER_LT_0_3_10
    | AuxdataStyle.VYPER_LT_0_3_5;

  // Vyper version is not semver compliant, so we need to handle it differently
  public compilerVersionCompatibleWithSemver: string;

  generateMetadata(output?: VyperOutput) {
    let outputMetadata: MetadataOutput;

    if (
      output?.contracts?.[this.compilationTarget.path]?.[
        this.compilationTarget.name
      ]
    ) {
      const contract =
        output.contracts[this.compilationTarget.path][
          this.compilationTarget.name
        ];
      outputMetadata = {
        abi: contract.abi,
        devdoc: contract.devdoc,
        userdoc: contract.userdoc,
      };
    } else {
      outputMetadata = {
        abi: [],
        devdoc: { kind: 'dev', methods: {} },
        userdoc: { kind: 'user', methods: {} },
      };
    }

    const sourcesWithHashes = Object.entries(this.jsonInput.sources).reduce(
      (acc, [path, source]) => ({
        ...acc,
        [path]: {
          keccak256: id(source.content),
          content: source.content,
        },
      }),
      {},
    );

    this.metadata = {
      compiler: { version: this.compilerVersion },
      language: 'Vyper',
      output: outputMetadata,
      settings: {
        ...this.jsonInput.settings,
        compilationTarget: {
          [this.compilationTarget.path]: this.compilationTarget.name,
        },
      },
      sources: sourcesWithHashes,
      version: 1,
    };
    this.metadataRaw = JSON.stringify(this.metadata);
  }

  initVyperJsonInput() {
    const outputSelection = {
      [this.compilationTarget.path]: [
        'abi',
        'ast',
        'interface',
        'ir',
        'userdoc',
        'devdoc',
        'evm.bytecode.object',
        'evm.bytecode.opcodes',
        'evm.deployedBytecode.object',
        'evm.deployedBytecode.opcodes',
        'evm.deployedBytecode.sourceMap',
        'evm.methodIdentifiers',
      ],
    };
    this.jsonInput.settings.outputSelection = outputSelection;
  }

  public constructor(
    public compiler: IVyperCompiler,
    public compilerVersion: string,
    public jsonInput: VyperJsonInput,
    public compilationTarget: CompilationTarget,
  ) {
    super();

    // Vyper beta and rc versions are not semver compliant, so we need to handle them differently
    if (semver.valid(this.compilerVersion)) {
      this.compilerVersionCompatibleWithSemver = this.compilerVersion;
    } else {
      // Check for beta or release candidate versions
      if (this.compilerVersion.match(/\d+\.\d+\.\d+(b\d+|rc\d+)/)) {
        this.compilerVersionCompatibleWithSemver = `${this.compilerVersion
          .split('+')[0]
          .replace(/(b\d+|rc\d+)$/, '')}+${this.compilerVersion.split('+')[1]}`;
      } else {
        throw new Error('Invalid Vyper compiler version');
      }
    }

    // Vyper version support for auxdata is different for each version
    if (semver.lt(this.compilerVersionCompatibleWithSemver, '0.3.5')) {
      this.auxdataStyle = AuxdataStyle.VYPER_LT_0_3_5;
    } else if (semver.lt(this.compilerVersionCompatibleWithSemver, '0.3.10')) {
      this.auxdataStyle = AuxdataStyle.VYPER_LT_0_3_10;
    } else {
      this.auxdataStyle = AuxdataStyle.VYPER;
    }
    this.initVyperJsonInput();
  }

  private getImmutableReferences(): ImmutableReferences {
    if (!this.creationBytecode || !this.runtimeBytecode) {
      throw new Error(
        'Cannot generate immutable references if bytecodes are not set',
      );
    }
    let immutableReferences = {};
    if (gte(this.compilerVersionCompatibleWithSemver, '0.3.10')) {
      try {
        const { immutableSize } = decode(
          this.creationBytecode,
          this.auxdataStyle,
        );
        if (immutableSize) {
          immutableReferences = {
            '0': [
              {
                length: immutableSize,
                start: this.runtimeBytecode.substring(2).length / 2,
              },
            ],
          };
        }
      } catch (e) {
        logWarn('Cannot decode vyper contract bytecode', {
          creationBytecode: this.creationBytecode,
        });
      }
    }
    return immutableReferences;
  }

  public async recompile(): Promise<RecompilationResult> {
    await this.recompileAndReturnContract(false);
    this.generateMetadata(this.compilerOutput);

    if (!this.metadataRaw) {
      logError('Cannot generate fake metadata for vyper', {
        compilerVersion: this.compilerVersion,
        compilationTarget: this.compilationTarget,
      });
      throw new Error('Cannot generate fake metadata for vyper');
    }

    return {
      creationBytecode: this.creationBytecode!,
      runtimeBytecode: this.runtimeBytecode!,
      metadata: this.metadataRaw,
      immutableReferences: this.getImmutableReferences(),
      creationLinkReferences: {},
      runtimeLinkReferences: {},
    };
  }

  /**
   * Generate the cbor auxdata positions for the creation and runtime bytecodes.
   * @returns false if the auxdata positions cannot be generated, true otherwise.
   */
  public async generateCborAuxdataPositions() {
    if (
      !this.creationBytecode ||
      !this.runtimeBytecode ||
      !this.compilerOutput
    ) {
      return false;
    }

    const [, runtimeAuxdataCbor, runtimeCborLengthHex] = splitAuxdata(
      this.runtimeBytecode,
      this.auxdataStyle,
    );

    this.runtimeBytecodeCborAuxdata = this.tryGenerateCborAuxdataPosition(
      this.runtimeBytecode,
      runtimeAuxdataCbor,
      runtimeCborLengthHex,
    );

    const [, creationAuxdataCbor, creationCborLengthHex] = splitAuxdata(
      this.creationBytecode,
      this.auxdataStyle,
    );

    this.creationBytecodeCborAuxdata = this.tryGenerateCborAuxdataPosition(
      this.creationBytecode,
      creationAuxdataCbor,
      creationCborLengthHex,
    );

    return true;
  }

  private tryGenerateCborAuxdataPosition(
    bytecode: string,
    auxdataCbor: string,
    cborLengthHex: string,
  ): CompiledContractCborAuxdata {
    if (!auxdataCbor) {
      return {};
    }

    const auxdataFromRawBytecode = `${auxdataCbor}${cborLengthHex}`;

    // Handles vyper lower than 0.3.10 in which the auxdata length bytes count
    const auxdataLengthOffset =
      this.auxdataStyle === AuxdataStyle.VYPER_LT_0_3_10 ? 2 : 0;

    return {
      '1': {
        offset:
          // we divide by 2 because we store the length in bytes (without 0x)
          bytecode.substring(2).length / 2 -
          parseInt(
            cborLengthHex ||
              'b' /** handles vyper lower than 0.3.5 in which cborLengthHex is '' */,
            16,
          ) -
          auxdataLengthOffset,
        value: `0x${auxdataFromRawBytecode}`,
      },
    };
  }
}
