import * as HttpStatus from 'http-status-codes';
import { IResponseError } from '../interfaces';

export class ValidationError implements IResponseError {
    code: number;
    message: string;
    log: boolean;
    errors: any[];

    constructor(validationErrors: any[], log: boolean = true) {
        this.code = HttpStatus.BAD_REQUEST;
        this.message = 'Validation Error';
        this.log = log;
        this.errors = validationErrors.map((e: any) =>  {
            return {
                field: e.param,
                message: e.msg
            };
        });
    }
}
