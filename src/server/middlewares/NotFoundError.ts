import * as HttpStatus from 'http-status-codes';
import { Request, Response, NextFunction } from 'express';

export default function notFoundError(req: Request, res: Response, next: NextFunction): void {
  res.status(HttpStatus.NOT_FOUND).json({
    code: HttpStatus.NOT_FOUND,
    message: HttpStatus.getStatusText(HttpStatus.NOT_FOUND)
  });
}
