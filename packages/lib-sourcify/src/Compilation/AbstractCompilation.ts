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
} from './SolidityTypes';
import { IVyperCompiler, VyperJsonInput, VyperOutput } from './VyperTypes';

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
}
