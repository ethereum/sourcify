import { NotFoundError } from "../../common/errors";
import { v4 as uuidv4 } from "uuid";

export type ErrorCode = "unsupported_chain";

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
