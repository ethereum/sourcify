import { StringMap } from '../Compilation/CompilationTypes';
import { SourcifyLibError } from '../SourcifyLibError';
import { Transformation, TransformationValues } from './Transformations';

export interface BytecodeMatchingResult {
  match: 'perfect' | 'partial' | null;
  libraryMap?: StringMap;
  normalizedRecompiledBytecode: string;
  transformations: Transformation[];
  transformationValues: TransformationValues;
  message?: string;
}

export type VerificationErrorCode =
  | 'CANT_FETCH_BYTECODE'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'COMPILED_BYTECODE_IS_ZERO'
  | 'EXTRA_FILE_INPUT_BUG'
  | 'CREATION_BYTECODE_MATCH_ERROR'
  | 'NO_MATCH'
  | 'ONCHAIN_RUNTIME_BYTECODE_NOT_AVAILABLE'
  | 'ONCHAIN_CREATION_BYTECODE_NOT_AVAILABLE';

export class VerificationError extends SourcifyLibError {
  constructor(message: string, code: VerificationErrorCode) {
    super(message, code);
  }
}

export enum SolidityBugType {
  NONE,
  IR_OUTPUT_ORDERING_BUG,
}

export type VerificationStatus = 'perfect' | 'partial' | null;
