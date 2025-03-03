import { StringMap } from '../Compilation/CompilationTypes';
import { SourcifyLibError } from '../SourcifyLibError';
import { Transformation, TransformationValues } from './Transformations';

export interface BytecodeMatchingResult {
  match: 'perfect' | 'partial' | null;
  libraryMap?: StringMap;
  populatedRecompiledBytecode: string;
  transformations: Transformation[];
  transformationValues: TransformationValues;
  message?: string;
}

export type VerificationErrorCode =
  | 'cant_fetch_bytecode'
  | 'contract_not_deployed'
  | 'compiled_bytecode_is_zero'
  | 'extra_file_input_bug'
  | 'creation_bytecode_match_error'
  | 'no_match'
  | 'onchain_runtime_bytecode_not_available'
  | 'onchain_creation_bytecode_not_available'
  | 'bytecode_length_mismatch';

export class VerificationError extends SourcifyLibError {
  constructor(message: string, code: VerificationErrorCode) {
    super(message, code);
  }
}

export enum SolidityBugType {
  NONE,
  IR_OUTPUT_ORDERING_BUG,
  EXTRA_FILE_INPUT_BUG,
}

export type VerificationStatus = 'perfect' | 'partial' | null;
