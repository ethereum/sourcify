import { Request } from "express";
import { Session } from "express-session";
import {
  PathContent,
  CheckedContract,
  isEmpty,
  StringMap,
  PathBuffer,
  Status,
} from "@ethereum-sourcify/core";
import Web3 from "web3";
import { MissingSources } from "@ethereum-sourcify/core";
import { InvalidSources } from "@ethereum-sourcify/core";
import QueryString from "qs";
import { BadRequestError } from "../../common/errors";
import fetch from "node-fetch";
export interface PathContentMap {
  [id: string]: PathContent;
}

export type ContractLocation = {
  chain: string;
  address: string;
};

export type ContractMeta = {
  compiledPath?: string;
  name?: string;
  address?: string;
  chainId?: string;
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

export type SessionMaps = {
  inputFiles: PathContentMap;
  contractWrappers: ContractWrapperMap;
};

export type MySession = Session &
  SessionMaps & {
    unusedSources: string[];
  };

export type MyRequest = Request & {
  addresses: string[];
  chain: string;
  chosenContract: number;
};

export type SendableContract = ContractMeta & {
  files: {
    found: string[];
    missing: MissingSources;
    invalid: InvalidSources;
  };
  verificationId: string;
  constructorArguments?: any;
  creationBytecode?: string;
};

export type EtherscanResult = {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
};

export function isVerifiable(contractWrapper: ContractWrapper) {
  const contract = contractWrapper.contract;
  return (
    isEmpty(contract.missing) &&
    isEmpty(contract.invalid) &&
    Boolean(contractWrapper.address) &&
    Boolean(contractWrapper.chainId)
  );
}

function getSendableContract(
  contractWrapper: ContractWrapper,
  verificationId: string
): SendableContract {
  const contract = contractWrapper.contract;

  return {
    verificationId,
    constructorArguments: contract?.metadata?.output?.abi?.find(
      (abi: any) => abi.type === "constructor"
    )?.inputs,
    creationBytecode: contract?.creationBytecode,
    compiledPath: contract.compiledPath,
    name: contract.name,
    address: contractWrapper.address,
    chainId: contractWrapper.chainId,
    files: {
      found: Object.keys(contract.solidity), // Source paths
      missing: contract.missing,
      invalid: contract.invalid,
    },
    status: contractWrapper.status || "error",
    statusMessage: contractWrapper.statusMessage,
    storageTimestamp: contractWrapper.storageTimestamp,
  };
}

export function getSessionJSON(session: MySession) {
  const contractWrappers = session.contractWrappers || {};
  const contracts: SendableContract[] = [];
  for (const id in contractWrappers) {
    const sendableContract = getSendableContract(contractWrappers[id], id);
    contracts.push(sendableContract);
  }

  const files: string[] = [];
  for (const id in session.inputFiles) {
    files.push(session.inputFiles[id].path);
  }
  const unused = session.unusedSources || [];
  return { contracts, unused, files };
}

export async function addRemoteFile(
  query: QueryString.ParsedQs
): Promise<PathBuffer[]> {
  if (typeof query.url !== "string") {
    throw new BadRequestError("Query url must be a string");
  }
  let res;
  try {
    res = await fetch(query.url);
  } catch (err) {
    throw new BadRequestError("Couldn't fetch from " + query.url);
  }
  if (!res.ok) throw new BadRequestError("Couldn't fetch from " + query.url);
  // Save with the fileName exists on server response header.
  const fileName =
    res.headers.get("Content-Disposition")?.split("filename=")[1] ||
    query.url.substring(query.url.lastIndexOf("/") + 1) ||
    "file";
  const buffer = await res.buffer();
  return [
    {
      path: fileName,
      buffer,
    },
  ];
}

export function generateId(obj: any): string {
  return Web3.utils.keccak256(JSON.stringify(obj));
}

export function updateUnused(unused: string[], session: MySession) {
  if (!session.unusedSources) {
    session.unusedSources = [];
  }
  session.unusedSources = unused;
}

export function contractHasMultipleFiles(sourceCodeObject: string) {
  if (sourceCodeObject.startsWith("{{")) {
    return true;
  }
  return false;
}
