import { NextFunction, RequestHandler, Request, Response } from "express";
import { InternalServerError } from "../../common/errors";
import logger from "../../common/logger";

export const safeHandler = <T extends Request = Request>(
  requestHandler: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return async (req: T, res: Response, next: NextFunction) => {
    try {
      return await requestHandler(req, res as any, next);
    } catch (err: any) {
      logger.info("safeHandler", {
        errorMessage: err.message,
        errorStack: err.stack,
      });
      next(typeof err === "object" ? err : new InternalServerError(err.mesage));
    }
  };
};
