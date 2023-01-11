import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class NotFoundError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.NOT_FOUND;
    this.message = message || "Resouce not found";
  }
}
