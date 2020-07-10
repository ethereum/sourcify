import * as HttpStatus from 'http-status-codes';
import { IResponseError } from '../interfaces';

export class BadRequestError implements IResponseError {
    code: number;
    message: string;

    constructor(message?: string) {
        this.code = HttpStatus.BAD_REQUEST,
        this.message = message || 'Bad request';
    }
}
