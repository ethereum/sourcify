import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  BadRequestError,
  InternalServerError,
  PayloadTooLargeError,
  ValidationError,
} from "../../../common/errors";
import {
  CheckedContract,
  InvalidSources,
  Match,
  MissingSources,
  PathContent,
  Status,
  checkFiles,
  isEmpty,
  useAllSources,
} from "@ethereum-sourcify/lib-sourcify";
import { Session } from "express-session";
import { AbiConstructor, AbiParameter } from "abitype";
import QueryString from "qs";
import fetch from "node-fetch";
import { IVerificationService } from "../../services/VerificationService";
import { IRepositoryService } from "../../services/RepositoryService";
import { ContractMeta, ContractWrapper } from "../../common";
import { id as keccak256str } from "ethers";

type PathBuffer = {
  path: string;
  buffer: Buffer;
};

export type LegacyVerifyRequest = Request & {
  body: {
    addresses: string[];
    chain: string;
    chosenContract: number;
    /* contextVariables?: {
        abiEncodedConstructorArguments?: string;
        msgSender?: string;
      }; */
  };
};

export const extractFiles = (req: Request, shouldThrow = false) => {
  if (req.is("multipart/form-data") && (req.files as any)?.files) {
    return extractFilesFromForm((req.files as any).files);
  } else if (req.is("application/json") && req.body.files) {
    return extractFilesFromJSON(req.body.files);
  }

  if (shouldThrow) {
    throw new ValidationError("There should be files in the <files> field");
  }
};

const extractFilesFromForm = (files: any): PathBuffer[] => {
  if (!Array.isArray(files)) {
    files = [files];
  }
  return files.map((f: any) => ({ path: f.name, buffer: f.data }));
};

export const extractFilesFromJSON = (files: {
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

export const FILE_ENCODING = "base64";
export const MAX_SESSION_SIZE = 50 * 1024 * 1024; // 50 MiB

export function generateId(obj: any): string {
  return keccak256str(JSON.stringify(obj));
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

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

// Contract object in the server response.
export type SendableContract = ContractMeta & {
  files: {
    found: string[];
    missing: MissingSources;
    invalid: InvalidSources;
  };
  verificationId: string;
  constructorArgumentsArray?: Mutable<AbiParameter[]>;
  creationBytecode?: string;
};

function getSendableContract(
  contractWrapper: ContractWrapper,
  verificationId: string
): SendableContract {
  const contract = contractWrapper.contract;

  return {
    verificationId,
    constructorArgumentsArray: (
      contract?.metadata?.output?.abi?.find(
        (abi) => abi.type === "constructor"
      ) as AbiConstructor
    )?.inputs as Mutable<AbiParameter[]>,
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

export interface ContractWrapperMap {
  [id: string]: ContractWrapper;
}

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

export const verifyContractsInSession = async (
  contractWrappers: ContractWrapperMap,
  session: Session,
  verificationService: IVerificationService,
  repositoryService: IRepositoryService
): Promise<void> => {
  for (const id in contractWrappers) {
    const contractWrapper = contractWrappers[id];

    // Check if contract is already verified
    if (Boolean(contractWrapper.address) && Boolean(contractWrapper.chainId)) {
      const found = repositoryService.checkByChainAndAddress(
        contractWrapper.address as string,
        contractWrapper.chainId as string
      );

      if (found.length) {
        contractWrapper.status = found[0].status || "error";
        contractWrapper.statusMessage = found[0].message;
        contractWrapper.storageTimestamp = found[0].storageTimestamp;
        continue;
      }
    }

    await checkAndFetchMissing(contractWrapper.contract);

    if (!isVerifiable(contractWrapper)) {
      continue;
    }

    const {
      address,
      chainId,
      contract,
      /* contextVariables, */ creatorTxHash,
    } = contractWrapper;

    // The session saves the CheckedContract as a simple object, so we need to reinstantiate it
    const checkedContract = new CheckedContract(
      contract.metadata,
      contract.solidity,
      contract.missing,
      contract.invalid
    );

    let match: Match;
    try {
      match = await verificationService.verifyDeployed(
        checkedContract,
        chainId as string,
        address as string,
        /* contextVariables, */
        creatorTxHash
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
          address as string
          /* contextVariables */
        );
        if (tempMatch.status === "perfect" || tempMatch.status === "partial") {
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

    contractWrapper.status = match.status || "error";
    contractWrapper.statusMessage = match.message;
    contractWrapper.storageTimestamp = match.storageTimestamp;
    if (match.status) {
      await repositoryService.storeMatch(checkedContract, match);
    }
  }
};

export function authenticatedRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sourcifyClientTokensRaw = process.env.CREATE2_CLIENT_TOKENS;
  if (sourcifyClientTokensRaw?.length) {
    const sourcifyClientTokens = sourcifyClientTokensRaw.split(",");
    const clientToken = req.body.clientToken;
    if (!clientToken) {
      throw new BadRequestError("This API is protected by a client token");
    }
    if (!sourcifyClientTokens.includes(clientToken)) {
      throw new BadRequestError("The client token you provided is not valid");
    }
  }
  next();
}
