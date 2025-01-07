import { AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';
import { VyperOutput } from './IVyperCompiler';
import {
  CompiledContractCborAuxdata,
  InvalidSources,
  Language,
  Metadata,
  MissingSources,
  RecompilationResult,
  SolidityOutput,
  StringMap,
} from './types';

/**
 * Checks whether the provided object contains any keys or not.
 * @param obj The object whose emptiness is tested.
 * @returns true if any keys present; false otherwise
 */
export function isEmpty(obj: object): boolean {
  return !Object.keys(obj).length && obj.constructor === Object;
}

export abstract class AbstractCheckedContract {
  metadata!: Metadata;
  sources!: StringMap;
  compiledPath!: string;
  compilerVersion!: string;
  name!: string;
  creationBytecode?: string;
  runtimeBytecode?: string;
  metadataRaw!: string;
  missing: MissingSources = {};
  invalid: InvalidSources = {};
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

  // Function to export the minimum information to reconstruct the CheckedContract
  abstract exportConstructorArguments(): {
    language: Language;
    metadata: Metadata;
    sources: StringMap;
    compiledPath: string;
    name: string;
    missing: MissingSources;
    invalid: InvalidSources;
  };

  /** Checks whether this contract is valid or not.
   * @param ignoreMissing a flag indicating that missing sources should be ignored
   * @returns true if no sources are missing or are invalid (malformed); false otherwise
   */
  public isValid(ignoreMissing = false): boolean {
    return (isEmpty(this.missing) || ignoreMissing) && isEmpty(this.invalid);
  }
}
