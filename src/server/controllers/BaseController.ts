import { InternalServerError } from '../../common/errors';
import { NextFunction, Request, Response } from 'express';

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export default class BaseController {
    safeHandler = (requestHandler: RequestHandler) => {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                return await requestHandler(req, res, next);
            } catch (err) {
                next(typeof err === 'object' ? err : new InternalServerError(err));
            }
        };
    }
}
