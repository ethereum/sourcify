import {
  CompilerOutput,
  MetadataOutput,
  RecompilationResult,
  StringMap,
} from './types';
import { logInfo, logSilly, logWarn } from './logger';
import {
  IVyperCompiler,
  VyperJsonInput,
  VyperSettings,
} from './IVyperCompiler';
import { AbstractCheckedContract } from './AbstractCheckedContract';
import { id } from 'ethers';

/**
 * Abstraction of a checked vyper contract. With metadata and source (vyper) files.
 */
export class VyperCheckedContract extends AbstractCheckedContract {
  /** The vyper compiler used to compile the checked contract */
  vyperCompiler: IVyperCompiler;
  vyperSettings: VyperSettings;
  vyperJsonInput!: VyperJsonInput;

  generateMetadata(output?: CompilerOutput) {
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
        'evm.deployedBytecode.sourceMapFull',
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
    this.compiledPath = compiledPath;
    this.name = name;
    this.sources = sources;
    this.vyperSettings = vyperSettings;
    this.initVyperJsonInput();
  }

  public async recompile(
    forceEmscripten = false,
  ): Promise<RecompilationResult> {
    const version = this.metadata.compiler.version;

    const compilationStartTime = Date.now();
    logInfo('Compiling contract', {
      version,
      contract: this.name,
      path: this.compiledPath,
      forceEmscripten,
    });
    logSilly('Compilation input', { VyperJsonInput: this.vyperJsonInput });
    this.compilerOutput = await this.vyperCompiler.compile(
      version,
      this.vyperJsonInput,
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
      contract: this.name,
      path: this.compiledPath,
      forceEmscripten,
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
      immutableReferences:
        contract.evm?.deployedBytecode?.immutableReferences || {},
      creationLinkReferences: contract?.evm?.bytecode?.linkReferences || {},
      runtimeLinkReferences:
        contract?.evm?.deployedBytecode?.linkReferences || {},
    };
  }
}
