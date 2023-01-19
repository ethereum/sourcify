import { Request } from "express";
import { isAddress } from "ethers/lib/utils";
import { toChecksumAddress, AbiInput } from "web3-utils";
import { PayloadTooLargeError, ValidationError } from "../../common/errors";
import { UploadedFile } from "express-fileupload";
import {
  CheckedContract,
  checkFiles,
  InvalidSources,
  isEmpty,
  Match,
  MissingSources,
  PathContent,
  Status,
  useAllSources,
} from "@ethereum-sourcify/lib-sourcify";
import { checkChainId } from "../../sourcify-chains";
import { validationResult } from "express-validator";
import { Session } from "express-session";
import QueryString from "qs";
import { BadRequestError } from "../../common/errors";
import fetch from "node-fetch";
import Web3 from "web3";
import VerificationService from "../services/VerificationService";
import RepositoryService from "../services/RepositoryService";

export interface PathContentMap {
  [id: string]: PathContent;
}

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

export type LegacyVerifyRequest = Request & {
  addresses: string[];
  chain: string;
  chosenContract: number;
  contextVariables?: {
    abiEncodedConstructorArguments?: string;
    msgSender?: string;
  };
};

type PathBuffer = {
  path: string;
  buffer: Buffer;
};

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

export const extractFiles = (req: Request, shouldThrow = false) => {
  if (req.is("multipart/form-data") && req.files && req.files.files) {
    return extractFilesFromForm(req.files.files);
  } else if (req.is("application/json") && req.body.files) {
    return extractFilesFromJSON(req.body.files);
  }

  if (shouldThrow) {
    throw new ValidationError([
      { param: "files", msg: "There should be files in the <files> field" },
    ]);
  }
};

const extractFilesFromForm = (
  files: UploadedFile | UploadedFile[]
): PathBuffer[] => {
  if (!Array.isArray(files)) {
    files = [files];
  }
  return files.map((f) => ({ path: f.name, buffer: f.data }));
};

const extractFilesFromJSON = (files: {
  [key: string]: string;
}): PathBuffer[] => {
  const inputFiles: PathBuffer[] = [];
  for (const name in files) {
    const file = files[name];
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    inputFiles.push({ path: name, buffer });
  }
  return inputFiles;
};

export const stringifyInvalidAndMissing = (contract: CheckedContract) => {
  const errors = Object.keys(contract.invalid).concat(
    Object.keys(contract.missing)
  );
  return `${contract.name} (${errors.join(", ")})`;
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

export const validateRequest = (req: Request) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new ValidationError(result.array());
  }
};

export type ContractMeta = {
  compiledPath?: string;
  name?: string;
  address?: string;
  chainId?: string;
  contextVariables?: {
    abiEncodedConstructorArguments?: string;
    msgSender?: string;
  };
  status?: Status;
  statusMessage?: string;
  storageTimestamp?: Date;
};

export type ContractWrapper = ContractMeta & {
  contract: CheckedContract;
};

// Contract object in the server response.
export type SendableContract = ContractMeta & {
  files: {
    found: string[];
    missing: MissingSources;
    invalid: InvalidSources;
  };
  verificationId: string;
  constructorArgumentsArray?: [AbiInput];
  creationBytecode?: string;
};

function getSendableContract(
  contractWrapper: ContractWrapper,
  verificationId: string
): SendableContract {
  const contract = contractWrapper.contract;

  return {
    verificationId,
    constructorArgumentsArray: contract?.metadata?.output?.abi?.find(
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

export function getSessionJSON(session: Session) {
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

export const FILE_ENCODING = "base64";
export const MAX_SESSION_SIZE = 50 * 1024 * 1024; // 50 MiB

export function generateId(obj: any): string {
  return Web3.utils.keccak256(JSON.stringify(obj));
}

export const saveFiles = (
  pathContents: PathContent[],
  session: Session
): number => {
  if (!session.inputFiles) {
    session.inputFiles = {};
  }

  let inputSize = 0; // shall contain old buffer size + new files size
  for (const id in session.inputFiles) {
    const pc = session.inputFiles[id];
    inputSize += pc.content.length;
  }

  pathContents.forEach((pc) => (inputSize += pc.content.length));

  if (inputSize > MAX_SESSION_SIZE) {
    const msg =
      "Too much session memory used. Delete some files or clear the session.";
    throw new PayloadTooLargeError(msg);
  }

  let newFilesCount = 0;
  pathContents.forEach((pc) => {
    const newId = generateId(pc.content);
    if (!(newId in session.inputFiles)) {
      session.inputFiles[newId] = pc;
      ++newFilesCount;
    }
  });

  return newFilesCount;
};

export function updateUnused(unused: string[], session: Session) {
  if (!session.unusedSources) {
    session.unusedSources = [];
  }
  session.unusedSources = unused;
}

export const checkContractsInSession = async (session: Session) => {
  const pathBuffers: PathBuffer[] = [];
  for (const id in session.inputFiles) {
    const pathContent = session.inputFiles[id];
    pathBuffers.push({
      path: pathContent.path,
      buffer: Buffer.from(pathContent.content, FILE_ENCODING),
    });
  }

  try {
    const unused: string[] = [];
    const contracts = await checkFiles(pathBuffers, unused);

    const newPendingContracts: ContractWrapperMap = {};
    for (const contract of contracts) {
      newPendingContracts[generateId(JSON.stringify(contract.metadataRaw))] = {
        contract,
      };
    }

    session.contractWrappers ||= {};
    for (const newId in newPendingContracts) {
      const newContractWrapper = newPendingContracts[newId];
      const oldContractWrapper = session.contractWrappers[newId];
      if (oldContractWrapper) {
        for (const path in newContractWrapper.contract.solidity) {
          oldContractWrapper.contract.solidity[path] =
            newContractWrapper.contract.solidity[path];
          delete oldContractWrapper.contract.missing[path];
        }
        oldContractWrapper.contract.solidity =
          newContractWrapper.contract.solidity;
        oldContractWrapper.contract.missing =
          newContractWrapper.contract.missing;
      } else {
        session.contractWrappers[newId] = newContractWrapper;
      }
    }
    updateUnused(unused, session);
  } catch (error) {
    const paths = pathBuffers.map((pb) => pb.path);
    updateUnused(paths, session);
  }
};

export const checkAndFetchMissing = async (
  contract: CheckedContract
): Promise<void> => {
  if (!CheckedContract.isValid(contract)) {
    try {
      // Try to fetch missing files
      await CheckedContract.fetchMissing(contract);
    } catch (e) {
      // There's no need to throw inside fetchMissing if we're going to do an empty catch. This would cause not being able to catch other potential errors inside the function. TODO: Don't throw inside `fetchMissing` and remove the try/catch block.
      // Missing files are accessible from the contract.missingFiles array.
      // No need to throw an error
    }
  }
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

export const verifyValidated = async (
  contractWrappers: ContractWrapperMap,
  session: Session,
  verificationService: VerificationService,
  repositoryService: RepositoryService
): Promise<void> => {
  for (const id in contractWrappers) {
    const contractWrapper = contractWrappers[id];

    await checkAndFetchMissing(contractWrapper.contract);

    if (!isVerifiable(contractWrapper)) {
      continue;
    }

    const { address, chainId, contract, contextVariables } = contractWrapper;

    // The session saves the CheckedContract as a simple object, so we need to reinstantiate it
    const checkedContract = new CheckedContract(
      contract.metadata,
      contract.solidity,
      contract.missing,
      contract.invalid
    );

    const found = repositoryService.checkByChainAndAddress(
      contractWrapper.address as string,
      contractWrapper.chainId as string
    );
    let match: Match;
    if (found.length) {
      match = found[0];
    } else {
      try {
        match = await verificationService.verifyDeployed(
          checkedContract,
          chainId as string,
          address as string,
          contextVariables
        );
        // Send to verification again with all source files.
        if (match.status === "extra-file-input-bug") {
          // Session inputFiles are encoded base64. Why?
          const pathBufferInputFiles: PathBuffer[] = Object.values(
            session.inputFiles
          ).map((base64file) => ({
            path: base64file.path,
            buffer: Buffer.from(base64file.content, FILE_ENCODING),
          }));
          const contractWithAllSources = await useAllSources(
            contractWrapper.contract,
            pathBufferInputFiles
          );
          const tempMatch = await verificationService.verifyDeployed(
            contractWithAllSources,
            chainId as string,
            address as string,
            contextVariables
          );
          if (
            tempMatch.status === "perfect" ||
            tempMatch.status === "partial"
          ) {
            match = tempMatch;
          }
        }
      } catch (error: any) {
        match = {
          chainId: contractWrapper.chainId as string,
          status: null,
          address: contractWrapper.address as string,
          message: error.message,
        };
      }
    }
    contractWrapper.status = match.status || "error";
    contractWrapper.statusMessage = match.message;
    contractWrapper.storageTimestamp = match.storageTimestamp;
  }
};
