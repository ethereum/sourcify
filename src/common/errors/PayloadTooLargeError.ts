import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class PayloadTooLargeError implements IResponseError {
  code: number;
  message: string;
  log: boolean;

  constructor(message?: string, log = true) {
    this.code = StatusCodes.REQUEST_TOO_LONG;
    this.message = message || "Payload too large";
    this.log = log;
  }
}
