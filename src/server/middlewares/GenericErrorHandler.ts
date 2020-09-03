import * as HttpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { Logger } from '../../utils/logger/Logger';
import * as bunyan from 'bunyan';

export default function genericErrorHandler(err: any, _req: Request, res: Response, _next: any): void {
  const logger: bunyan = Logger("Error");
  logger.error(`Error: ${JSON.stringify(err)}`);
  if (err.errors) {
    res.status(err.code).json({
      message: err.message,
      errors: err.errors
    });
    return;
  }
  const errorCode = +err.code || err.status || 500;
  res.status(errorCode).json({
    error: err.message || HttpStatus.getStatusText(errorCode)
  });
}
