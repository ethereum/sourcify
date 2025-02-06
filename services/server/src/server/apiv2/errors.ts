import { BadRequestError, NotFoundError } from "../../common/errors";
import { v4 as uuidv4 } from "uuid";

export type ErrorCode =
  | VerificationError
  | "unsupported_chain"
  | "invalid_parameter"
  | "proxy_resolution_error"
  | "job_not_found";

export interface GenericErrorResponse {
  customCode: ErrorCode;
  message: string;
  errorId: string;
}

export class ChainNotFoundError extends NotFoundError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "unsupported_chain",
      message,
      errorId: uuidv4(),
    };
  }
}

export class InvalidParametersError extends BadRequestError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "invalid_parameter",
      message,
      errorId: uuidv4(),
    };
  }
}

export class JobNotFoundError extends NotFoundError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "job_not_found",
      message,
      errorId: uuidv4(),
    };
  }
}

// TODO: Add sensible error codes here,
// possibly from lib-sourcify after the verification flow refactoring
export type VerificationError = "non_existing_contract";

export function getVerificationErrorMessage(
  code: VerificationError,
  chainId: string,
  address: string,
) {
  switch (code) {
    case "non_existing_contract":
      return `Contract ${address} does not exist on chain ${chainId}`;
    default:
      return `Unknown verification error`;
  }
}
