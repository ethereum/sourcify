import { NextFunction, RequestHandler, Request, Response } from "express";
import { InternalServerError } from "../../common/errors";
import logger from "../../common/logger";
import { getAddress } from "ethers";

export const safeHandler = (requestHandler: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Middlewares can access req.params.* only after routes are defined
    if (req.params.address) {
      req.params.address = getAddress(req.params.address);
    }
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
