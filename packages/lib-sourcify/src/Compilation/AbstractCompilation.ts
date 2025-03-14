import { AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';
import {
  CompilationTarget,
  CompiledContractCborAuxdata,
  Metadata,
  CompilationLanguage,
  StringMap,
  LinkReferences,
  CompilationError,
} from './CompilationTypes';
import {
  ImmutableReferences,
  ISolidityCompiler,
  SolidityJsonInput,
  SolidityOutput,
  SolidityOutputContract,
} from './SolidityTypes';
import {
  IVyperCompiler,
  VyperJsonInput,
  VyperOutput,
  VyperOutputContract,
} from './VyperTypes';
import { logInfo, logSilly, logWarn } from '../logger';

export abstract class AbstractCompilation {
  /**
   * Constructor parameters
   */
  abstract compiler: ISolidityCompiler | IVyperCompiler;
  abstract compilerVersion: string;
  abstract compilationTarget: CompilationTarget;
  abstract jsonInput: SolidityJsonInput | VyperJsonInput;

  protected _metadata?: Metadata;
  compilerOutput?: SolidityOutput | VyperOutput;

  abstract auxdataStyle: AuxdataStyle;
  abstract language: CompilationLanguage;

  /** Marks the positions of the CborAuxdata parts in the bytecode */
  protected _creationBytecodeCborAuxdata?: CompiledContractCborAuxdata;
  protected _runtimeBytecodeCborAuxdata?: CompiledContractCborAuxdata;

  /**
   * Recompiles the contract with the specified compiler settings
   * @param forceEmscripten Whether to force using the WebAssembly binary for compilation (only for Solidity)
   */
  abstract compile(forceEmscripten?: boolean): Promise<void>;
  abstract generateCborAuxdataPositions(
    forceEmscripten?: boolean,
  ): Promise<void>;

  public async compileAndReturnCompilationTarget(
    forceEmscripten = false,
  ): Promise<SolidityOutputContract | VyperOutputContract> {
    const version = this.compilerVersion;

    const compilationStartTime = Date.now();
    logInfo('Compiling contract', {
      version,
      contract: this.compilationTarget.name,
      path: this.compilationTarget.path,
      forceEmscripten,
    });
    logSilly('Compilation input', { solcJsonInput: this.jsonInput });
    try {
      this.compilerOutput = await this.compiler.compile(
        version,
        this.jsonInput as any,
        forceEmscripten,
      );
    } catch (e: any) {
      logWarn('Compiler error', {
        error: e.message,
      });
      throw new CompilationError('compiler_error');
    }

    if (this.compilerOutput === undefined) {
      logWarn('Compiler error: compilerOutput is undefined');
      throw new CompilationError('no_compiler_output');
    }

    // We call contractCompilerOutput() before logging because it can throw an error
    const compilationTargetContract = this.contractCompilerOutput;

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

    return compilationTargetContract;
  }

  get contractCompilerOutput(): SolidityOutputContract | VyperOutputContract {
    if (!this.compilerOutput) {
      logWarn('Compiler output is undefined');
      throw new CompilationError('no_compiler_output');
    }
    if (
      !this.compilerOutput.contracts ||
      !this.compilerOutput.contracts[this.compilationTarget.path] ||
      !this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ]
    ) {
      logWarn('Contract not found in compiler output');
      throw new CompilationError('contract_not_found_in_compiler_output');
    }
    return this.compilerOutput.contracts[this.compilationTarget.path][
      this.compilationTarget.name
    ];
  }

  get creationBytecode() {
    return `0x${this.contractCompilerOutput.evm.bytecode.object}`;
  }

  get runtimeBytecode() {
    return `0x${this.contractCompilerOutput.evm.deployedBytecode.object}`;
  }

  get metadata() {
    if (!this._metadata) {
      throw new CompilationError('metadata_not_set');
    }
    return this._metadata;
  }

  get sources() {
    return Object.keys(this.jsonInput.sources).reduce((acc, source) => {
      acc[source] = this.jsonInput.sources[source].content;
      return acc;
    }, {} as StringMap);
  }

  abstract get immutableReferences(): ImmutableReferences;
  abstract get runtimeLinkReferences(): LinkReferences;
  abstract get creationLinkReferences(): LinkReferences;

  get creationBytecodeCborAuxdata(): CompiledContractCborAuxdata {
    if (!this._creationBytecodeCborAuxdata) {
      throw new CompilationError('creation_bytecode_cbor_auxdata_not_set');
    }
    return this._creationBytecodeCborAuxdata;
  }

  get runtimeBytecodeCborAuxdata(): CompiledContractCborAuxdata {
    if (!this._runtimeBytecodeCborAuxdata) {
      throw new CompilationError('runtime_bytecode_cbor_auxdata_not_set');
    }
    return this._runtimeBytecodeCborAuxdata;
  }
}
