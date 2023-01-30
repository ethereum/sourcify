import * as HttpStatus from "http-status-codes";
import { Request, Response } from "express";
import { SourcifyEventManager } from "../../common/SourcifyEventManager/SourcifyEventManager";

export default function genericErrorHandler(
  err: any,
  _req: Request,
  res: Response,
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

  if (err.errors) {
    res.status(err.code).json({
      message: err.message,
      errors: err.errors,
    });
    return;
  }
  const errorCode = +err.code || err.status || 500;
  res.status(errorCode).json({
    error: err.message || HttpStatus.getStatusText(errorCode),
  });
}
