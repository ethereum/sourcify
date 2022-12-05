import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class PayloadTooLargeError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.REQUEST_TOO_LONG;
    this.message = message || "Payload too large";
  }
}
