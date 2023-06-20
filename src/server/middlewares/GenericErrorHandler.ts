import * as HttpStatus from "http-status-codes";
import { Request, Response } from "express";
import { SourcifyEventManager } from "../../common/SourcifyEventManager/SourcifyEventManager";

export default function genericErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  // Next function is required for Express to recognize this as an error handler. Error handlers must have 4 parameters.
  _next: any
): void {
  if (err) {
    SourcifyEventManager.trigger("Server.Error", {
      message: err.message,
      stack: err.stack,
      request: {
        api: _req.path,
        parameters: _req.body,
      },
    });
  }
  const errorCode = +err.code || err.status || 500;

  if (err.errors) {
    // This is a validation error
    res.status(errorCode).json({
      message: err.message,
      errors: err.errors,
    });
    return;
  }
  res.status(errorCode).json({
    error: err.message || HttpStatus.getStatusText(errorCode), // Need to keep this for backward compatibility, but ideally we should respond with `message` only
    message: err.message || HttpStatus.getStatusText(errorCode),
  });
}
