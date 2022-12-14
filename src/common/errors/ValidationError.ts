import { StatusCodes } from "http-status-codes";
import { IResponseError } from "../interfaces";

export class ValidationError implements IResponseError {
  code: number;
  message: string;
  errors: any[];

  constructor(validationErrors: any[]) {
    this.code = StatusCodes.BAD_REQUEST;
    const errorParams = validationErrors.map((e) => e.param);
    this.message = `Validation Error: ${errorParams.join(", ")}`;
    this.errors = validationErrors.map((e: any) => {
      return {
        field: e.param,
        message: e.msg,
      };
    });
  }
}
