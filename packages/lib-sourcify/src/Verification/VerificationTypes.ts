import { StringMap } from '../Compilation/CompilationTypes';
import { SourcifyLibError } from '../SourcifyLibError';
import { Transformation, TransformationValues } from './Transformations';

export interface BytecodeMatchingContext {
  isCreation: boolean;
  normalizedRecompiledBytecode: string;
}

export interface BytecodeMatchingResult {
  match: 'perfect' | 'partial' | null;
  libraryMap?: StringMap;
  normalizedRecompiledBytecode: string;
  transformations: Transformation[];
  transformationValues: TransformationValues;
  message?: string;
}

export enum VerificationErrorCode {
  CHAIN_UNAVAILABLE = 1001,
  CONTRACT_NOT_DEPLOYED = 1002,
  COMPILED_BYTECODE_IS_ZERO = 1003,
  EXTRA_FILE_INPUT_BUG = 1005,
  FAILED_TO_CHECK_EXTRA_FILE_INPUT_BUG = 1006,
  CREATION_BYTECODE_MATCH_ERROR = 1007,
  NO_MATCH = 1008,
  ONCHAIN_RUNTIME_BYTECODE_NOT_AVAILABLE = 1009,
  ONCHAIN_CREATION_BYTECODE_NOT_AVAILABLE = 1010,
}

export class VerificationError extends SourcifyLibError {
  constructor(message: string, code: VerificationErrorCode) {
    super(message, code);
    this.name = 'VerificationError';
  }
}

export enum SolidityBugType {
  NONE,
  ECMASCRIPT_BUG,
}
