import { StatusCodes } from 'http-status-codes';
import { IResponseError } from '../interfaces';

export class InternalServerError implements IResponseError {
  code: number;
  message: string;
  log: boolean;

  constructor(message?: string, log = true) {
    this.code = StatusCodes.INTERNAL_SERVER_ERROR,
    this.message = message || 'Something went wrong',
    this.log = log;
  }
}
