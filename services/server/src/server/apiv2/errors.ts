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
  | VerificationError
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
  recompiledCreationCode?: string;
  recompiledRuntimeCode?: string;
  onchainCreationCode?: string;
  onchainRuntimeCode?: string;
  creatorTransactionHash?: string;
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

// TODO: Add sensible error codes here,
// possibly from lib-sourcify after the verification flow refactoring
export type VerificationError =
  | "non_existing_contract"
  | "non_matching_bytecodes";

export function getVerificationErrorMessage(
  code: VerificationError,
  chainId: string,
  address: string,
) {
  switch (code) {
    case "non_existing_contract":
      return `Contract ${address} does not exist on chain ${chainId}`;
    case "non_matching_bytecodes":
      return `The onchain and recompiled bytecodes don't match`;
    default:
      return `Unknown verification error`;
  }
}
