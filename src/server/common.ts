import { isAddress } from "ethers/lib/utils";
import { validationResult } from "express-validator";
import { ValidationError } from "../common/errors";
import { checkChainId } from "../sourcify-chains";
import {
  CheckedContract,
  PathContent,
  Status,
} from "@ethereum-sourcify/lib-sourcify";
import { toChecksumAddress } from "web3-utils";

export const validateAddresses = (addresses: string): string[] => {
  const addressesArray = addresses.split(",");
  const invalidAddresses: string[] = [];
  for (const i in addressesArray) {
    const address = addressesArray[i];
    if (!isAddress(address)) {
      invalidAddresses.push(address);
    } else {
      addressesArray[i] = toChecksumAddress(address);
    }
  }

  if (invalidAddresses.length) {
    throw new Error(`Invalid addresses: ${invalidAddresses.join(", ")}`);
  }
  return addressesArray;
};

export const validateRequest = (req: Request) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new ValidationError(result.array());
  }
};

/**
 * Validation function for multiple chainIds
 * Note that this checks if a chain exists as a SourcifyChain.
 * This is different that checking for verification support i.e. supported: true or monitoring support i.e. monitored: true
 */
export const validateChainIds = (chainIds: string): string[] => {
  const chainIdsArray = chainIds.split(",");
  const validChainIds: string[] = [];
  const invalidChainIds: string[] = [];
  for (const chainId of chainIdsArray) {
    try {
      if (chainId === "0") {
        // create2 verified contract
        validChainIds.push("0");
      } else {
        validChainIds.push(checkChainId(chainId));
      }
    } catch (e) {
      invalidChainIds.push(chainId);
    }
  }

  if (invalidChainIds.length) {
    throw new Error(`Invalid chainIds: ${invalidChainIds.join(", ")}`);
  }
  return validChainIds;
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
