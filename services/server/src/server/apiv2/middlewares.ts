import { Request, Response, NextFunction } from "express";
import { ChainRepository } from "../../sourcify-chain-repository";
import logger from "../../common/logger";
import {
  ChainNotFoundError,
  InvalidParametersError as InvalidParameterError,
  InvalidParametersError,
} from "./errors";
import { getAddress } from "ethers";
import { FIELDS_TO_STORED_PROPERTIES } from "../services/utils/database-util";
import { reduceAccessorStringToProperty } from "../services/utils/util";

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

export function validateAddress(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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
      new InvalidParameterError(`Invalid address: ${req.params.address}`),
    );
  }

  next();
}

export function validateFieldsAndOmit(
  req: Request & { query: { fields?: string; omit?: string } },
  res: Response,
  next: NextFunction,
) {
  if (req.query.fields && req.query.omit) {
    throw new InvalidParametersError("Cannot specify both fields and omit");
  }

  const fields = req.query.fields?.split(",");
  const omits = req.query.omit?.split(",");

  const validateField = (fullField: string) => {
    const splitField = fullField.split(".");
    if (splitField.length > 2) {
      throw new InvalidParametersError(
        `Field selector cannot have more than one level subselectors: ${fullField}`,
      );
    }

    try {
      reduceAccessorStringToProperty(fullField, FIELDS_TO_STORED_PROPERTIES);
    } catch (error) {
      throw new InvalidParametersError(
        `Field selector ${fullField} is not a valid field`,
      );
    }
  };

  fields?.forEach(validateField);

  omits?.forEach(validateField);

  next();
}
