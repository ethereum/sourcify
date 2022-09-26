import { StatusCodes } from 'http-status-codes';
import { IResponseError } from '../interfaces';

export class BadRequestError implements IResponseError {
  code: number;
  message: string;
  log: boolean;

  constructor(message?: string, log = true) {
    this.code = StatusCodes.BAD_REQUEST,
    this.message = message || 'Bad request',
    this.log = log;
  }
}
