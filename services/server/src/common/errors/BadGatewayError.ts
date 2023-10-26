import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class BadGatewayError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.BAD_GATEWAY;
    this.message = message || "Bad gateway";
  }
}
