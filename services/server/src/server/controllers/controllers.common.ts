import { NextFunction, RequestHandler, Request, Response } from "express";
import { BadRequestError, InternalServerError } from "../../common/errors";
import logger from "../../common/logger";
import { getAddress } from "ethers";

export const safeHandler = <T extends Request = Request>(
  requestHandler: (req: T, res: Response, next: NextFunction) => Promise<any>,
) => {
  return async (req: T, res: Response, next: NextFunction) => {
    try {
      // Middlewares can access req.params.* only after routes are defined
      if (req.params.address) {
        // Checksum the address
        req.params.address = getAddress(req.params.address);
      }
    } catch (err: any) {
      logger.info("Invalid address in params", {
        errorMessage: err.message,
        errorStack: err.stack,
        params: req.params,
      });
      return next(
        new BadRequestError(`Invalid address: ${req.params.address}`),
      );
    }
    try {
      return await requestHandler(req, res as any, next);
    } catch (err: any) {
      logger.info("safeHandler", {
        errorMessage: err.message,
        errorStack: err.stack,
      });
      return next(
        typeof err === "object" ? err : new InternalServerError(err.mesage),
      );
    }
  };
};
