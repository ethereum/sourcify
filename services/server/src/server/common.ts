import {
  InvalidSources,
  CompilationLanguage,
  Metadata,
  MissingSources,
  PathContent,
  VerificationStatus,
  StringMap,
  Verification,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "../common/logger";
import { InternalServerError } from "express-openapi-validator/dist/openapi.validator";
import { Request, Response, NextFunction } from "express";
import { Match } from "./types";

export const safeHandler = <T extends Request = Request>(
  requestHandler: (req: T, res: Response, next: NextFunction) => Promise<any>,
) => {
  return async (req: T, res: Response, next: NextFunction) => {
    try {
      return await requestHandler(req, res as any, next);
    } catch (err: any) {
      logger.info("safeHandler", {
        errorMessage: err.message,
        errorStack: err.stack,
      });
      return next(
        typeof err === "object" ? err : new InternalServerError(err.message),
      );
    }
  };
};

export interface PathContentMap {
  [id: string]: PathContent;
}

export type ContractMeta = {
  compiledPath?: string;
  name?: string;
  address?: string;
  chainId?: string;
  creatorTxHash?: string;
  status?: VerificationStatus;
  statusMessage?: string;
  storageTimestamp?: Date;
};

export type ContractWrapperData = {
  language: CompilationLanguage;
  metadata: Metadata;
  sources: StringMap;
  missing: MissingSources;
  invalid: InvalidSources;
  creationBytecode?: string;
  compiledPath?: string;
  name?: string;
};

export type ContractWrapper = ContractMeta & {
  contract: ContractWrapperData;
};

export interface ContractWrapperMap {
  [id: string]: ContractWrapper;
}

declare module "express-session" {
  interface Session {
    inputFiles: PathContentMap;
    contractWrappers: ContractWrapperMap;
    unusedSources: string[];
  }
}
