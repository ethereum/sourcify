import * as HttpStatus from 'http-status-codes';
import { IResponseError } from '../interfaces';

export class ValidationError implements IResponseError {
    code: number;
    message: string;
    errors: any[];

    constructor(validationErrors: any[]) {
        this.code = HttpStatus.BAD_REQUEST;
        this.message = 'Validation Error';
        this.errors = validationErrors.map((e: any) =>  {
            return {
                field: e.param,
                message: e.msg
            };
        });
    }
}
