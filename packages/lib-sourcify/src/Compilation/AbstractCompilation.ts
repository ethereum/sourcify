import { AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';
import {
  CompilationTarget,
  CompiledContractCborAuxdata,
  Metadata,
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
import { logInfo, logSilly, logWarn } from '../lib/logger';

export abstract class AbstractCompilation {
  /**
   * Constructor parameters
   */
  abstract compiler: ISolidityCompiler | IVyperCompiler;
  abstract compilerVersion: string;
  abstract compilationTarget: CompilationTarget;
  abstract jsonInput: SolidityJsonInput | VyperJsonInput;

  metadata?: Metadata;
  compilerOutput?: SolidityOutput | VyperOutput;

  abstract auxdataStyle: AuxdataStyle;

  /** Marks the positions of the CborAuxdata parts in the bytecode */
  creationBytecodeCborAuxdata?: CompiledContractCborAuxdata;
  runtimeBytecodeCborAuxdata?: CompiledContractCborAuxdata;

  /**
   * Recompiles the contract with the specified compiler settings
   * @param forceEmscripten Whether to force using emscripten for compilation
   */
  abstract compile(forceEmscripten?: boolean): Promise<void>;
  abstract generateCborAuxdataPositions(
    forceEmscripten?: boolean,
  ): Promise<boolean>;

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
    this.compilerOutput = await this.compiler.compile(
      version,
      this.jsonInput as any,
      forceEmscripten,
    );
    if (this.compilerOutput === undefined) {
      const error = new Error('Compiler error');
      logWarn('Compiler error', {
        errorMessages: ['compilerOutput is undefined'],
      });
      throw error;
    }

    // We call getCompilationTarget() before logging because it can throw an error
    const compilationTarget = this.getCompilationTarget();

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

    return compilationTarget;
  }

  getCompilationTarget(): SolidityOutputContract | VyperOutputContract {
    if (!this.compilerOutput) {
      logWarn('Compiler output is undefined');
      throw new Error('Compiler output is undefined');
    }
    if (
      !this.compilerOutput.contracts ||
      !this.compilerOutput.contracts[this.compilationTarget.path] ||
      !this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ]
    ) {
      const error = new Error('Contract not found in compiler output');
      logWarn('Contract not found in compiler output');
      throw error;
    }
    return this.compilerOutput.contracts[this.compilationTarget.path][
      this.compilationTarget.name
    ];
  }

  getCreationBytecode() {
    return `0x${this.getCompilationTarget().evm.bytecode.object}`;
  }

  getRuntimeBytecode() {
    return `0x${this.getCompilationTarget().evm.deployedBytecode.object}`;
  }

  getMetadata(): Metadata {
    if (!this.metadata) {
      throw new Error('Metadata is not set');
    }
    return this.metadata;
  }

  abstract getImmutableReferences(): ImmutableReferences;
}
