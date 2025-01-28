import { BadRequestError, NotFoundError } from "../../common/errors";
import { v4 as uuidv4 } from "uuid";

export type ErrorCode =
  | "unsupported_chain"
  | "invalid_parameter"
  | "proxy_resolution_error";

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
