import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from "../../common/errors";
import { v4 as uuidv4 } from "uuid";
import type { Request, Response, NextFunction } from "express";
import { error as openApiValidatorErrors } from "express-openapi-validator";
import logger from "../../common/logger";
import {
  ErrorMessagePayload,
  getErrorMessageFromCode,
  SourcifyLibErrorCode,
} from "@ethereum-sourcify/lib-sourcify";

export type ErrorCode =
  | VerificationErrorCode
  | "unknown_error"
  | "route_not_found"
  | "unsupported_chain"
  | "invalid_parameter"
  | "proxy_resolution_error"
  | "job_not_found";

export interface GenericErrorResponse {
  customCode: ErrorCode;
  message: string;
  errorId: string;
}

export interface MatchingErrorResponse extends GenericErrorResponse {
  customCode: VerificationErrorCode;
  recompiledCreationCode?: string;
  recompiledRuntimeCode?: string;
  onchainCreationCode?: string;
  onchainRuntimeCode?: string;
  creationTransactionHash?: string;
}

export class MatchingError extends Error {
  constructor(public response: MatchingErrorResponse) {
    super(response.message);
  }
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

export class JobNotFoundError extends NotFoundError {
  payload: GenericErrorResponse;

  constructor(message: string) {
    super(message);
    this.payload = {
      customCode: "job_not_found",
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

  next(new UnknownError("The server encountered an unexpected error."));
}

export type VerificationErrorCode =
  | SourcifyLibErrorCode
  | "unsupported_language"
  | "unknown_error";

export function getVerificationErrorMessage(
  code: VerificationErrorCode,
  payload?: ErrorMessagePayload,
) {
  switch (code) {
    case "unsupported_language":
      return "The provided language is not supported.";
    case "unknown_error":
      return "The server encountered an unexpected error.";
    default:
      return getErrorMessageFromCode(code, payload);
  }
}
