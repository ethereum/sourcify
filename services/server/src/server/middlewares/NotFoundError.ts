import * as HttpStatus from "http-status-codes";
import { Request, Response } from "express";

export default function notFoundError(
  err: any,
  _req: Request,
  res: Response,
  _next: any
): void {
  res.status(HttpStatus.StatusCodes.NOT_FOUND).json({
    error: HttpStatus.getStatusText(err.message),
  });
}
