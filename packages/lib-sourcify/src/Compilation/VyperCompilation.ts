import { logWarn } from '../lib/logger';
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
} from './CompilationTypes';
import { ImmutableReferences } from './SolidityTypes';

/**
 * Abstraction of a checked vyper contract. With metadata and source (vyper) files.
 */
export class VyperCompilation extends AbstractCompilation {
  // Use declare to override AbstractCompilation's types to target Solidity types
  declare compilerOutput?: VyperOutput;
  declare compileAndReturnCompilationTarget: (
    forceEmscripten: boolean,
  ) => Promise<VyperOutputContract>;

  // Specify the auxdata style, used for extracting the auxdata from the compiler output
  public auxdataStyle:
    | AuxdataStyle.VYPER
    | AuxdataStyle.VYPER_LT_0_3_10
    | AuxdataStyle.VYPER_LT_0_3_5;

  // Vyper version is not semver compliant, so we need to handle it differently
  public compilerVersionCompatibleWithSemver: string;

  generateMetadata() {
    const contract = this.getCompilationTarget();
    const outputMetadata = {
      abi: contract.abi,
      devdoc: contract.devdoc,
      userdoc: contract.userdoc,
    };

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

  getImmutableReferences(): ImmutableReferences {
    if (!this.getCreationBytecode() || !this.getRuntimeBytecode()) {
      throw new Error(
        'Cannot generate immutable references if bytecodes are not set',
      );
    }
    let immutableReferences = {};
    if (gte(this.compilerVersionCompatibleWithSemver, '0.3.10')) {
      try {
        const { immutableSize } = decode(
          this.getCreationBytecode(),
          this.auxdataStyle,
        );
        if (immutableSize) {
          immutableReferences = {
            '0': [
              {
                length: immutableSize,
                start: this.getRuntimeBytecode().substring(2).length / 2,
              },
            ],
          };
        }
      } catch (e) {
        logWarn('Cannot decode vyper contract bytecode', {
          creationBytecode: this.getCreationBytecode(),
        });
      }
    }
    return immutableReferences;
  }

  public async compile() {
    await this.compileAndReturnCompilationTarget(false);
    this.generateMetadata();
  }
  /**
   * Generate the cbor auxdata positions for the creation and runtime bytecodes.
   * @returns false if the auxdata positions cannot be generated, true otherwise.
   */
  public async generateCborAuxdataPositions() {
    const [, runtimeAuxdataCbor, runtimeCborLengthHex] = splitAuxdata(
      this.getRuntimeBytecode(),
      this.auxdataStyle,
    );

    this.runtimeBytecodeCborAuxdata = this.tryGenerateCborAuxdataPosition(
      this.getRuntimeBytecode(),
      runtimeAuxdataCbor,
      runtimeCborLengthHex,
    );

    const [, creationAuxdataCbor, creationCborLengthHex] = splitAuxdata(
      this.getCreationBytecode(),
      this.auxdataStyle,
    );

    this.creationBytecodeCborAuxdata = this.tryGenerateCborAuxdataPosition(
      this.getCreationBytecode(),
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
