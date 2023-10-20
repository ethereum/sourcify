import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class InternalServerError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.INTERNAL_SERVER_ERROR;
    this.message = message || "Something went wrong";
  }
}
