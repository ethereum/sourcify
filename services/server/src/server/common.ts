import {
  InvalidSources,
  Language,
  Match,
  Metadata,
  MissingSources,
  PathContent,
  Status,
  StringMap,
  Verification,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "../common/logger";
import { InternalServerError } from "express-openapi-validator/dist/openapi.validator";
import { Request, Response, NextFunction } from "express";

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
  status?: Status;
  statusMessage?: string;
  storageTimestamp?: Date;
};

export type ContractWrapperData = {
  language: Language;
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

export interface ResponseMatch
  extends Omit<Match, "runtimeMatch" | "creationMatch"> {
  status: Status;
}

export function getMatchStatus(match: Match): Status {
  if (match.runtimeMatch === "perfect" || match.creationMatch === "perfect") {
    return "perfect";
  }
  if (match.runtimeMatch === "partial" || match.creationMatch === "partial") {
    return "partial";
  }
  if (match.runtimeMatch === "extra-file-input-bug") {
    return "extra-file-input-bug";
  }
  return null;
}

export function getResponseMatchFromMatch(match: Match): ResponseMatch {
  const status = getMatchStatus(match);
  const responseMatch = {
    ...match,
    status,
    runtimeMatch: undefined,
    creationMatch: undefined,
  };

  return responseMatch;
}

export function getMatchStatusFromVerification(
  verification: Verification,
): Status {
  if (
    verification.status.runtimeMatch === "perfect" ||
    verification.status.creationMatch === "perfect"
  ) {
    return "perfect";
  }
  if (
    verification.status.runtimeMatch === "partial" ||
    verification.status.creationMatch === "partial"
  ) {
    return "partial";
  }
  if (verification.status.runtimeMatch === "extra-file-input-bug") {
    return "extra-file-input-bug";
  }
  return null;
}

// TODO: implement this
export function getResponseMatchFromVerification(
  verification: Verification,
): ResponseMatch {
  const status = getMatchStatusFromVerification(verification);
  const responseMatch = {
    address: verification.address,
    chainId: verification.chainId.toString(),
    runtimeMatch: verification.status.runtimeMatch,
    creationMatch: verification.status.creationMatch,
    message: "",
    abiEncodedConstructorArguments: "",
    create2Args: {
      deployerAddress: "",
      salt: "",
      constructorArgs: [],
    },
    libraryMap: {},
    creatorTxHash: "",
    immutableReferences: {},
    runtimeTransformations: [],
    creationTransformations: [],
    runtimeTransformationValues: verification.transformations.runtime.values,
    creationTransformationValues: verification.transformations.creation.values,
    onchainRuntimeBytecode: "",
    onchainCreationBytecode: "",
    blockNumber: undefined,
    txIndex: undefined,
    deployer: undefined,
    contractName: "",
    status,
  };

  return responseMatch;
}
