import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class ValidationError implements IResponseError {
  code: number;
  message: string;

  constructor(message: string) {
    this.code = StatusCodes.BAD_REQUEST;
    this.message = message;
  }
}
