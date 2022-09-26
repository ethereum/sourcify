import { StatusCodes } from 'http-status-codes';
import { IResponseError } from '../interfaces';

export class ValidationError implements IResponseError {
  code: number;
  message: string;
  log: boolean;
  errors: any[];

  constructor(validationErrors: any[], log = true) {
    this.code = StatusCodes.BAD_REQUEST;
    const errorParams = validationErrors.map(e => e.param);
    this.message = `Validation Error: ${errorParams.join(", ")}`;
    this.log = log;
    this.errors = validationErrors.map((e: any) =>  {
      return {
        field: e.param,
        message: e.msg
      };
    });
  }
}
