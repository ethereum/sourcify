import {NextFunction, Request, Response} from "express";
import { log } from './utils';
export class HttpException extends Error {
    status?: number;
    message: string;
    name: string;
  
    constructor(message: string, name: string, status?: number) {
      super(message);
      this.message = message || "Something went wrong";
      this.name = name || "HttpException";
      this.status = status || 500;
    }
  }
  
  export class BadRequest extends HttpException {
    constructor(message: string) {
      super(message, "BadRequest", 401);
    }
  }
  
  export class NotFound extends HttpException {
    constructor(message: string) {
      super(message, "NotFound", 404);
    }
  }
  
  // All Error and HttpException properties
  /* tslint:disable:no-unused-variable */
  export function errorMiddleware(
    error: Error & HttpException,
    request: Request,
    response: Response,
    next: NextFunction
  ) : void {

      const status = error.status || 500;
      const message = error.message || "Something went wrong";
    
      log.info({
        loc: error.status,
        err: message
      })
  
      response
        .status(status)
        .send({
          error: message
        });
      }
  