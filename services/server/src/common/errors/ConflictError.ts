import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class ConflictError implements IResponseError {
  code: number;
  message: string;

  constructor(message?: string) {
    this.code = StatusCodes.CONFLICT;
    this.message =
      message || "Conflict between the request body vs. the server state";
  }
}
