import { NextFunction, RequestHandler, Request, Response } from "express";
import { InternalServerError } from "../../common/errors";

export const safeHandler = (requestHandler: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await requestHandler(req, res as any, next);
    } catch (err: any) {
      next(typeof err === "object" ? err : new InternalServerError(err.mesage));
    }
  };
};
