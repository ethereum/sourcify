import * as HttpStatus from 'http-status-codes';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger/Logger';
import * as bunyan from 'bunyan';

export default function genericErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const logger: bunyan = Logger("Error");
  logger.error(`Error: ${JSON.stringify(err)}`);
  if (err.errors) {
    res.status(err.code).json({
      code: err.code,
      message: err.message,
      errors: err.errors
    });
    return;
  }
  const errorCode = +err.code || err.status || 500;
  res.status(errorCode).json({
    code: errorCode,
    message: err.message || HttpStatus.getStatusText(errorCode)
  });
}
