import { MetadataOutput, RecompilationResult, StringMap } from './types';
import { logInfo, logSilly, logWarn } from './logger';
import {
  IVyperCompiler,
  VyperJsonInput,
  VyperOutput,
  VyperSettings,
} from './IVyperCompiler';
import { AbstractCheckedContract } from './AbstractCheckedContract';
import { id } from 'ethers';
import { AuxdataStyle, splitAuxdata } from '@ethereum-sourcify/bytecode-utils';
import semver from 'semver';

/**
 * Abstraction of a checked vyper contract. With metadata and source (vyper) files.
 */
export class VyperCheckedContract extends AbstractCheckedContract {
  /** The vyper compiler used to compile the checked contract */
  vyperCompiler: IVyperCompiler;
  vyperSettings: VyperSettings;
  vyperJsonInput!: VyperJsonInput;
  compilerOutput?: VyperOutput;
  auxdataStyle:
    | AuxdataStyle.VYPER
    | AuxdataStyle.VYPER_LT_0_3_10
    | AuxdataStyle.VYPER_LT_0_3_5;

  generateMetadata(output?: VyperOutput) {
    let outputMetadata: MetadataOutput;

    if (output?.contracts?.[this.compiledPath]?.[this.name]) {
      const contract = output.contracts[this.compiledPath][this.name];
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

    const sourcesWithHashes = Object.entries(this.sources).reduce(
      (acc, [path, content]) => ({
        ...acc,
        [path]: {
          content,
          keccak256: id(content),
        },
      }),
      {},
    );

    this.metadata = {
      compiler: { version: this.compilerVersion },
      language: 'Vyper',
      output: outputMetadata,
      settings: {
        ...this.vyperSettings,
        compilationTarget: { [this.compiledPath]: this.name },
      },
      sources: sourcesWithHashes,
      version: 1,
    };
    this.metadataRaw = JSON.stringify(this.metadata);
  }

  initVyperJsonInput() {
    this.vyperSettings.outputSelection = {
      [this.compiledPath]: [
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

    this.generateMetadata();

    this.vyperJsonInput = {
      language: 'Vyper',
      sources: Object.fromEntries(
        Object.entries(this.sources).map(([path, content]) => [
          path,
          { content },
        ]),
      ),
      settings: this.vyperSettings,
    };
  }

  public constructor(
    vyperCompiler: IVyperCompiler,
    vyperCompilerVersion: string,
    compiledPath: string,
    name: string,
    vyperSettings: VyperSettings,
    sources: StringMap,
  ) {
    super();
    this.vyperCompiler = vyperCompiler;
    this.compilerVersion = vyperCompilerVersion;

    // Vyper beta and rc versions are not semver compliant, so we need to handle them differently
    let compilerVersionForComparison = this.compilerVersion;
    if (!semver.valid(this.compilerVersion)) {
      // Check for beta or release candidate versions
      if (this.compilerVersion.match(/\d+\.\d+\.\d+(b\d+|rc\d+)/)) {
        compilerVersionForComparison = `${this.compilerVersion
          .split('+')[0]
          .replace(/(b\d+|rc\d+)$/, '')}+${this.compilerVersion.split('+')[1]}`;
      } else {
        throw new Error('Invalid Vyper compiler version');
      }
    }
    // Vyper version support for auxdata is different for each version
    if (semver.lt(compilerVersionForComparison, '0.3.5')) {
      this.auxdataStyle = AuxdataStyle.VYPER_LT_0_3_5;
    } else if (semver.lt(compilerVersionForComparison, '0.3.10')) {
      this.auxdataStyle = AuxdataStyle.VYPER_LT_0_3_10;
    } else {
      this.auxdataStyle = AuxdataStyle.VYPER;
    }
    this.compiledPath = compiledPath;
    this.name = name;
    this.sources = sources;
    this.vyperSettings = vyperSettings;
    this.initVyperJsonInput();
  }

  public async recompile(): Promise<RecompilationResult> {
    const version = this.metadata.compiler.version;

    const compilationStartTime = Date.now();
    logInfo('Compiling contract', {
      version,
      contract: this.name,
      path: this.compiledPath,
    });
    logSilly('Compilation input', { VyperJsonInput: this.vyperJsonInput });
    this.compilerOutput = await this.vyperCompiler.compile(
      version,
      this.vyperJsonInput,
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
      contract: this.name,
      path: this.compiledPath,
      compilationDuration: `${compilationDuration}ms`,
    });

    if (
      !this.compilerOutput.contracts ||
      !this.compilerOutput.contracts[this.compiledPath] ||
      !this.compilerOutput.contracts[this.compiledPath][this.name] ||
      !this.compilerOutput.contracts[this.compiledPath][this.name].evm ||
      !this.compilerOutput.contracts[this.compiledPath][this.name].evm.bytecode
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
      this.compilerOutput.contracts[this.compiledPath][this.name];

    this.creationBytecode = `${contract.evm.bytecode.object}`;
    this.runtimeBytecode = `${contract.evm?.deployedBytecode?.object}`;

    this.generateMetadata(this.compilerOutput);

    return {
      creationBytecode: this.creationBytecode,
      runtimeBytecode: this.runtimeBytecode,
      metadata: this.metadataRaw,
      // Sometimes the compiler returns empty object (not falsey). Convert it to undefined (falsey).
      immutableReferences: {},
      creationLinkReferences: {},
      runtimeLinkReferences: {},
    };
  }

  public async generateCborAuxdataPositions() {
    if (
      this.creationBytecode === undefined ||
      this.runtimeBytecode === undefined
    ) {
      return false;
    }

    if (this.compilerOutput === undefined) {
      return false;
    }

    // Extract the auxdata from the end of the recompiled runtime bytecode
    const [, runtimeAuxdataCbor, runtimeCborLengthHex] = splitAuxdata(
      this.runtimeBytecode,
      this.auxdataStyle,
    );

    this.runtimeBytecodeCborAuxdata = {};
    if (runtimeAuxdataCbor) {
      const auxdataFromRawRuntimeBytecode = `${runtimeAuxdataCbor}${runtimeCborLengthHex}`;

      // we divide by 2 because we store the length in bytes (without 0x)
      this.runtimeBytecodeCborAuxdata = {
        '1': {
          offset:
            this.runtimeBytecode.substring(2).length / 2 -
            parseInt(
              runtimeCborLengthHex ||
                '0' /** handles vyper lower than 0.3.5 in which runtimeCborLengthHex is '' */,
              16,
            ) -
            2,
          value: `0x${auxdataFromRawRuntimeBytecode}`,
        },
      };
    }

    // Try to extract the auxdata from the end of the recompiled creation bytecode
    const [, creationAuxdataCbor, creationCborLengthHex] = splitAuxdata(
      this.creationBytecode,
      this.auxdataStyle,
    );

    this.creationBytecodeCborAuxdata = {};
    // If we can find the auxdata at the end of the bytecode return; otherwise continue with `generateEditedContract`
    if (creationAuxdataCbor) {
      const auxdataFromRawCreationBytecode = `${creationAuxdataCbor}${creationCborLengthHex}`;

      // we divide by 2 because we store the length in bytes (without 0x)
      this.creationBytecodeCborAuxdata = {
        '1': {
          offset:
            this.creationBytecode.substring(2).length / 2 -
            parseInt(
              creationCborLengthHex ||
                '0' /** handles vyper lower than 0.3.5 in which creationCborLengthHex is '' */,
              16,
            ),
          value: `0x${auxdataFromRawCreationBytecode}`,
        },
      };
      return true;
    }
    return true;
  }
}
