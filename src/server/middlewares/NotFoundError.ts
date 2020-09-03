import * as HttpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { Logger } from '../../utils/logger/Logger';
import * as bunyan from 'bunyan';

export default function notFoundError(err: any, _req: Request, res: Response, _next: any): void {
  const logger: bunyan = Logger("Error");
  logger.error(`Error: ${JSON.stringify(err)}`);

  res.status(HttpStatus.NOT_FOUND).json({
    error: HttpStatus.getStatusText(err.message)
  });
}
