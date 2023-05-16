import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  InternalServerError,
  PayloadTooLargeError,
  ValidationError,
} from "../../../common/errors";
import {
  CheckedContract,
  InvalidSources,
  MissingSources,
  PathContent,
  Status,
  checkFiles,
} from "@ethereum-sourcify/lib-sourcify";
import { Session } from "express-session";
import Web3 from "web3";
import { AbiConstructor, AbiParameter } from "abitype";

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
  if (req.is("multipart/form-data") && req.files) {
    return extractFilesFromForm(req.files);
  } else if (req.is("application/json") && req.body.files) {
    return extractFilesFromJSON(req.body.files);
  }

  if (shouldThrow) {
    throw new ValidationError([
      { param: "files", msg: "There should be files in the <files> field" },
    ]);
  }
};

const extractFilesFromForm = (files: any): PathBuffer[] => {
  if (!Array.isArray(files)) {
    files = [files];
  }
  return files.map((f: any) => ({ path: f.originalname, buffer: f.buffer }));
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

export const safeHandler = (requestHandler: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await requestHandler(req, res as any, next);
    } catch (err: any) {
      next(typeof err === "object" ? err : new InternalServerError(err.mesage));
    }
  };
};

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
