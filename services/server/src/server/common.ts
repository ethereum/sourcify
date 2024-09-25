import { BadRequestError } from "../common/errors";
import {
  InvalidSources,
  Match,
  Metadata,
  MissingSources,
  PathContent,
  Status,
  StringMap,
} from "@ethereum-sourcify/lib-sourcify";
import { getAddress, isAddress } from "ethers";

export const validateSingleAddress = (address: string): boolean => {
  if (!isAddress(address)) {
    throw new BadRequestError(`Invalid address: ${address}`);
  }
  return true; // if it doesn't throw
};

export const validateAddresses = (addresses: string): boolean => {
  const addressesArray = addresses.split(",");
  const invalidAddresses: string[] = [];
  for (const i in addressesArray) {
    const address = addressesArray[i];
    if (!isAddress(address)) {
      invalidAddresses.push(address);
    } else {
      addressesArray[i] = getAddress(address);
    }
  }

  if (invalidAddresses.length) {
    throw new BadRequestError(
      `Invalid addresses: ${invalidAddresses.join(", ")}`,
    );
  }
  return true; // if it doesn't throw
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

export type ContractWrapper = ContractMeta & {
  contract: {
    metadata: Metadata;
    solidity: StringMap;
    missing: MissingSources;
    invalid: InvalidSources;
    creationBytecode?: string;
    compiledPath?: string;
    name?: string;
  };
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
