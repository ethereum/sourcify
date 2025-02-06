import { Request, Response, NextFunction } from "express";
import { getAddress } from "ethers";
import { BadRequestError, InternalServerError } from "../../common/errors";
import logger from "../../common/logger";
import { isContractAlreadyPerfect } from "./verification/verification.common";
import { getResponseMatchFromMatch } from "../common";
import { Services } from "../services/services";

export function validateAddress(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.params.address) {
    try {
      // Checksum the address
      req.params.address = getAddress(req.params.address);
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
  }
  next();
}

export async function checkPerfectMatch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // address and chain are always available because of openAPI validation
  const { address, chain } = req.body;
  const services = req.app.get("services") as Services;

  try {
    const result = await isContractAlreadyPerfect(
      services.storage,
      address,
      chain,
    );

    if (result) {
      return res.send({ result: [getResponseMatchFromMatch(result)] });
    }

    next();
  } catch (error: any) {
    logger.error("Error in checkPerfectMatch:", {
      error,
      address,
      chain,
    });
    return next(
      new InternalServerError(
        "Error while checking for existing perfect match",
      ),
    );
  }
}
