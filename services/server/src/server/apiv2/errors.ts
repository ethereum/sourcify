import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from "../../common/errors";
import { v4 as uuidv4 } from "uuid";
import { Request, Response, NextFunction } from "express";
import { error as openApiValidatorErrors } from "express-openapi-validator";
import logger from "../../common/logger";

export type ErrorCode =
  | "unknown_error"
  | "route_not_found"
  | "unsupported_chain"
  | "invalid_parameter"
  | "proxy_resolution_error";

export interface GenericErrorResponse {
  customCode: ErrorCode;
  message: string;
  errorId: string;
}

export class UnknownError extends InternalServerError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "unknown_error",
      message,
      errorId: uuidv4(),
    };
  }
}

export class RouteNotFoundError extends NotFoundError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "route_not_found",
      message,
      errorId: uuidv4(),
    };
  }
}

export class ChainNotFoundError extends NotFoundError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "unsupported_chain",
      message,
      errorId: uuidv4(),
    };
  }
}

export class InvalidParametersError extends BadRequestError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "invalid_parameter",
      message,
      errorId: uuidv4(),
    };
  }
}

// Maps OpenApiValidator errors to our custom error format
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Let errors pass that already match the v2 error format
  if (err.payload) {
    next(err);
    return;
  }

  if (
    err instanceof openApiValidatorErrors.BadRequest ||
    err instanceof openApiValidatorErrors.RequestEntityTooLarge ||
    err instanceof openApiValidatorErrors.UnsupportedMediaType
  ) {
    next(new InvalidParametersError(err.message));
    return;
  }

  logger.error("Unknown server error: ", err);
  next(new UnknownError("The server encountered an unexpected error."));
}
