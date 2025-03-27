import { CompilationErrorCode } from './Compilation/CompilationTypes';
import { ValidationErrorCode } from './Validation/ValidationTypes';
import { VerificationErrorCode } from './Verification/VerificationTypes';

export type SourcifyLibErrorCode =
  | ValidationErrorCode
  | CompilationErrorCode
  | VerificationErrorCode;

export interface ErrorMessagePayload {
  address?: string;
  chainId?: string;
}

export class SourcifyLibError extends Error {
  public code: SourcifyLibErrorCode;
  constructor(code: SourcifyLibErrorCode, payload?: ErrorMessagePayload) {
    super(getErrorMessageFromCode(code, payload));
    this.code = code;
  }
}

export function getErrorMessageFromCode(
  code: SourcifyLibErrorCode,
  payload: ErrorMessagePayload = {},
) {
  switch (code) {
    // Validation errors
    case 'missing_source':
      return 'One or more sources are mentioned in the metadata but are not provided or could not be fetched.';
    case 'missing_or_invalid_source':
      return 'One or more sources are mentioned in the metadata but are missing or are invalid.';
    case 'invalid_compilation_target':
      return 'The compilationTarget in the metadata is invalid.';
    // Compilation errors
    case 'compiler_error':
      return 'Compiler error.';
    case 'no_compiler_output':
      return 'Compiler output is undefined.';
    case 'contract_not_found_in_compiler_output':
      return 'Contract not found in compiler output.';
    case 'metadata_not_set':
      return 'No metadata on compilation object.';
    case 'creation_bytecode_cbor_auxdata_not_set':
      return 'No creation bytecode cbor auxdata on compilation object.';
    case 'runtime_bytecode_cbor_auxdata_not_set':
      return 'No runtime bytecode cbor auxdata on compilation object.';
    case 'invalid_compiler_version':
      return 'Invalid compiler version.';
    case 'cannot_generate_cbor_auxdata_positions':
      return 'Cannot generate cbor auxdata positions.';
    // Verification errors
    case 'cannot_fetch_bytecode':
      return `Cannot fetch bytecode for chain #${payload.chainId} and address ${payload.address}.`;
    case 'contract_not_deployed':
      return `Chain #${payload.chainId} does not have a contract deployed at ${payload.address}.`;
    case 'compiled_bytecode_is_zero':
      return 'The compiled contract bytecode is "0x". Are you trying to verify an abstract contract?';
    case 'extra_file_input_bug':
      return "It seems your contract's metadata hashes match but not the bytecodes. If you are verifying via metadata.json, use the original full standard JSON input file that has all files including those not needed by this contract. See the issue for more information: https://github.com/ethereum/sourcify/issues/618";
    case 'bytecode_length_mismatch':
      return "The recompiled bytecode length doesn't match the onchain bytecode length.";
    case 'no_match':
      return "The deployed and recompiled bytecode don't match.";
    case 'onchain_runtime_bytecode_not_available':
      return 'Onchain runtime bytecode not available.';
    case 'onchain_creation_bytecode_not_available':
      return 'Onchain creation bytecode not available.';
    // Unknown error
    default:
      return 'Unknown error.';
  }
}
