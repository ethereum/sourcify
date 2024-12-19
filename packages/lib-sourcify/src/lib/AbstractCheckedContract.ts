import { AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';
import { VyperOutput } from './IVyperCompiler';
import {
  CompiledContractCborAuxdata,
  Metadata,
  RecompilationResult,
  SolidityOutput,
  StringMap,
} from './types';

export abstract class AbstractCheckedContract {
  metadata!: Metadata;
  sources!: StringMap;
  compiledPath!: string;
  compilerVersion!: string;
  name!: string;
  creationBytecode?: string;
  runtimeBytecode?: string;
  metadataRaw!: string;
  abstract compilerOutput?: SolidityOutput | VyperOutput;
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
