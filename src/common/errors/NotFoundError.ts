import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class NotFoundError implements IResponseError {
  code: number;
  message: string;
  log: boolean;

  constructor(message?: string, log = true) {
    this.code = StatusCodes.NOT_FOUND;
    this.message = message || "Resouce not found";
    this.log = log;
  }
}
