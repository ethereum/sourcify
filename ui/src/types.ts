import { ParamType } from "@ethersproject/abi";
export declare interface StringMap {
  [key: string]: string;
}
export type DropzoneFile = File & {
  size: number;
  path: string;
};

export interface InvalidSources {
  [key: string]: {
    expectedHash: string;
    calculatedHash: string;
    msg?: string; // Keep msg for compatibilty with legacy UI
  };
}

export interface MissingSources {
  [key: string]: {
    keccak256: string;
    urls: string[];
  };
}
// Server session
export type SessionResponse = {
  contracts: SendableContract[];
  unused: string[];
  files: string[];
};
export interface IGenericError {
  error: string;
}

export interface IResponseError {
  code: number;
  message: string;
  log: boolean;
  errors?: any[];
}

export type Status = "perfect" | "partial" | "error";

export type ContractMeta = {
  compiledPath?: string;
  name?: string;
  address?: string;
  chainId?: string;
  status?: Status;
  statusMessage?: string;
  storageTimestamp?: Date;
};

export type SendableContract = ContractMeta & {
  files: {
    found: string[];
    missing: MissingSources;
    invalid: InvalidSources;
  };
  verificationId: string;
  constructorArgumentsArray?: [ParamType];
  creationBytecode?: string;
};

export type VerificationInput = {
  verificationId: string;
  chainId: string;
  address: string;
  /* contextVariables: {
    abiEncodedConstructorArguments?: string;
    msgSender?: string;
  }; */
  creatorTxHash?: string;
};

export type Create2VerificationInput = {
  verificationId: string;
  deployerAddress: string;
  salt: string;
  abiEncodedConstructorArguments: string;
  create2Address: string;
  clientToken: string;
};

export interface Match {
  address: string | null;
  chainId: string | null;
  status: Status;
  storageTimestamp?: Date;
  message?: string;
  abiEncodedConstructorArguments?: string;
  libraryMap?: StringMap;
}

export type CheckAllByAddressResult = {
  address: string;
  status?: string;
  chainIds: {
    chainId: string;
    status: string;
  }[];
  create2Args?: {
    deployerAddress?: string | undefined;
    salt?: string | undefined;
    constructorArgs?: any[] | undefined;
  };
};

export type Chain = {
  name: string;
  title?: string; // Longer name for some networks
  chainId: number;
  shortName: string;
  network: string;
  networkId: number;
  supported?: boolean;
  monitored?: boolean;
  etherscanAPI?: string;
};

export type ChainMap = {
  [id: number]: Chain;
};
