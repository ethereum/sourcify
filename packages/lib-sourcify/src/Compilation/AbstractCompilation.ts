import { AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';
import {
  CompilationTarget,
  CompiledContractCborAuxdata,
  Metadata,
  RecompilationResult,
} from './CompilationTypes';
import {
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
  metadataRaw?: string;
  creationBytecode?: string;
  runtimeBytecode?: string;
  compilerOutput?: SolidityOutput | VyperOutput;

  abstract auxdataStyle: AuxdataStyle;

  /** Marks the positions of the CborAuxdata parts in the bytecode */
  creationBytecodeCborAuxdata?: CompiledContractCborAuxdata;
  runtimeBytecodeCborAuxdata?: CompiledContractCborAuxdata;

  normalizedRuntimeBytecode?: string;
  normalizedCreationBytecode?: string;

  /**
   * Recompiles the contract with the specified compiler settings
   * @param forceEmscripten Whether to force using emscripten for compilation
   */
  abstract recompile(forceEmscripten?: boolean): Promise<RecompilationResult>;
  abstract generateCborAuxdataPositions(
    forceEmscripten?: boolean,
  ): Promise<boolean>;

  public async recompileAndReturnContract(
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
      ]
    ) {
      const error = new Error('Contract not found in compiler output');
      logWarn('Contract not found in compiler output');
      throw error;
    }

    const contract =
      this.compilerOutput.contracts[this.compilationTarget.path][
        this.compilationTarget.name
      ];

    this.creationBytecode = `0x${contract.evm.bytecode.object}`;
    this.runtimeBytecode = `0x${contract.evm?.deployedBytecode?.object}`;

    return contract;
  }
}
