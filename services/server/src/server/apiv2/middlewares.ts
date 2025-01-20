import { Request, Response, NextFunction } from "express";
import { ChainRepository } from "../../sourcify-chain-repository";
import logger from "../../common/logger";
import { ChainNotFoundError } from "./errors";

export function validateChainId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const chainRepository = req.app.get("chainRepository") as ChainRepository;

  try {
    chainRepository.checkSourcifyChainId(req.params.chainId);
  } catch (err: any) {
    logger.info("Invalid chainId in params", {
      errorMessage: err.message,
      errorStack: err.stack,
      params: req.params,
    });
    return next(
      new ChainNotFoundError(`Chain ${req.params.chainId} not found`),
    );
  }

  next();
}
