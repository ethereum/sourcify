import { NextFunction, RequestHandler, Request, Response } from "express";
import { InternalServerError } from "../../common/errors";
import logger from "../../common/logger";

export const safeHandler = (requestHandler: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await requestHandler(req, res as any, next);
    } catch (err: any) {
      logger.error("safeHandler", { errorMessage: err.message });
      next(typeof err === "object" ? err : new InternalServerError(err.mesage));
    }
  };
};
