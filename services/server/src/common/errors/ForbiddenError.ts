import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class ForbiddenError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.FORBIDDEN;
    this.message = message || "Forbidden";
  }
}
