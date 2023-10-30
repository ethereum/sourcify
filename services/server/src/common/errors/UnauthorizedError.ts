import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class UnauthorizedError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.UNAUTHORIZED;
    this.message = message || "Unauthorized";
  }
}
