import { BadRequestError } from "../common/errors";
import { checkSourcifyChainId } from "../sourcify-chains";
import {
  CheckedContract,
  PathContent,
  Status,
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
      `Invalid addresses: ${invalidAddresses.join(", ")}`
    );
  }
  return true; // if it doesn't throw
};

/**
 * Validation function for multiple chainIds
 * Note that this checks if a chain exists as a SourcifyChain.
 * This is different that checking for verification support i.e. supported: true or monitoring support i.e. monitored: true
 */
export const validateSourcifyChainIds = (chainIds: string) => {
  const chainIdsArray = chainIds.split(",");
  const validChainIds: string[] = [];
  const invalidChainIds: string[] = [];
  for (const chainId of chainIdsArray) {
    try {
      if (chainId === "0") {
        // create2 verified contract
        validChainIds.push("0");
      }
      if (checkSourcifyChainId(chainId)) {
        validChainIds.push(chainId);
      }
    } catch (e) {
      invalidChainIds.push(chainId);
    }
  }

  if (invalidChainIds.length) {
    throw new Error(`Invalid chainIds: ${invalidChainIds.join(", ")}`);
  }
  return true;
};

export interface PathContentMap {
  [id: string]: PathContent;
}

export type ContractMeta = {
  compiledPath?: string;
  name?: string;
  address?: string;
  chainId?: string;
  /* contextVariables?: {
      abiEncodedConstructorArguments?: string;
      msgSender?: string;
    }; */
  creatorTxHash?: string;
  status?: Status;
  statusMessage?: string;
  storageTimestamp?: Date;
};

export type ContractWrapper = ContractMeta & {
  contract: CheckedContract;
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
