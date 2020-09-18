import * as HttpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { Logger } from '../../../services/core/build/index';
import * as bunyan from 'bunyan';
import config from '../../config';

export default function notFoundError(err: any, _req: Request, res: Response, _next: any): void {
  const logger: bunyan = Logger(config.logging.dir, "Error");
  logger.error(`Error: ${JSON.stringify(err)}`);

  res.status(HttpStatus.NOT_FOUND).json({
    error: HttpStatus.getStatusText(err.message)
  });
}
