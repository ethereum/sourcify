import * as HttpStatus from 'http-status-codes';
import { Request, Response } from 'express';

export default function notFoundError(_req: Request, res: Response): void {
  res.status(HttpStatus.NOT_FOUND).json({
    code: HttpStatus.NOT_FOUND,
    message: HttpStatus.getStatusText(HttpStatus.NOT_FOUND)
  });
}
