import { Request } from "express";
import { BadRequestError, PayloadTooLargeError } from "../../../common/errors";
import {
  SolidityCheckedContract,
  InvalidSources,
  Match,
  Metadata,
  MissingSources,
  PathContent,
  StringMap,
  checkFilesWithMetadata,
  isEmpty,
  useAllSources,
  IVyperCompiler,
  Language,
  AbstractCheckedContract,
  VyperCheckedContract,
} from "@ethereum-sourcify/lib-sourcify";
import { Session } from "express-session";
import { AbiConstructor, AbiParameter } from "abitype";
import QueryString from "qs";
import { VerificationService } from "../../services/VerificationService";
import { ContractMeta, ContractWrapper, getMatchStatus } from "../../common";
import { ISolidityCompiler } from "@ethereum-sourcify/lib-sourcify";
import { StorageService } from "../../services/StorageService";
import logger from "../../../common/logger";
import { createHash } from "crypto";
import { ChainRepository } from "../../../sourcify-chain-repository";

export function createSolidityCheckedContract(
  solc: ISolidityCompiler,
  metadata: Metadata,
  solidity: StringMap,
  missing?: MissingSources,
  invalid?: InvalidSources,
) {
  return new SolidityCheckedContract(
    solc,
    metadata,
    solidity,
    missing,
    invalid,
  );
}

type PathBuffer = {
  path: string;
  buffer: Buffer;
};

export type LegacyVerifyRequest = Request & {
  body: {
    addresses: string[];
    chain: string;
    chosenContract: number;
  };
};

export const extractFiles = (req: Request, shouldThrow = false) => {
  if (req.is("multipart/form-data") && (req.files as any)?.files) {
    return extractFilesFromForm((req.files as any).files);
  } else if (req.is("application/json") && req.body.files) {
    return extractFilesFromJSON(req.body.files);
  }

  if (shouldThrow) {
    throw new BadRequestError("There should be files in the <files> field");
  }
};

const extractFilesFromForm = (files: any): PathBuffer[] => {
  if (!Array.isArray(files)) {
    files = [files];
  }
  logger.debug("extractFilesFromForm", {
    files: files.map((f: any) => f.name),
  });
  return files.map((f: any) => ({ path: f.name, buffer: f.data }));
};

export const extractFilesFromJSON = (files: {
  [key: string]: string;
}): PathBuffer[] => {
  logger.debug("extractFilesFromJSON", { files: Object.keys(files) });
  const inputFiles: PathBuffer[] = [];
  for (const name in files) {
    const file = files[name];
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    inputFiles.push({ path: name, buffer });
  }
  return inputFiles;
};

export const stringifyInvalidAndMissing = (
  contract: SolidityCheckedContract,
) => {
  const errors = Object.keys(contract.invalid).concat(
    Object.keys(contract.missing),
  );
  return `${contract.name} (${errors.join(", ")})`;
};

export const FILE_ENCODING = "base64";
export const MAX_SESSION_SIZE = 50 * 1024 * 1024; // 50 MiB

export function generateId(obj: any): string {
  const objString = JSON.stringify(obj);
  const hash = createHash("sha1").update(objString).digest("hex");
  return hash;
}

export const saveFilesToSession = (
  pathContents: PathContent[],
  session: Session,
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

  logger.info("Saved files to session", {
    newFilesCount,
    inputSize,
    sessionInputFilesLength: Object.keys(session.inputFiles).length,
    sessionId: session.id,
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
  // creationBytecode?: string; // Not needed without create2
};

function getSendableContract(
  contractWrapper: ContractWrapper,
  verificationId: string,
): SendableContract {
  const contract = contractWrapper.contract;

  return {
    verificationId,
    constructorArgumentsArray: (
      contract?.metadata?.output?.abi?.find(
        (abi) => abi.type === "constructor",
      ) as AbiConstructor
    )?.inputs as Mutable<AbiParameter[]>,
    // : contract?.creationBytecode, // Not needed without create2
    compiledPath: contract.compiledPath,
    name: contract.name,
    address: contractWrapper.address,
    chainId: contractWrapper.chainId,
    files: {
      found: Object.keys(contract.sources), // Source paths
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

export const checkContractsInSession = async (
  solc: ISolidityCompiler,
  vyper: IVyperCompiler,
  session: Session,
) => {
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
    const contracts = await checkFilesWithMetadata(
      solc,
      vyper,
      pathBuffers,
      unused,
    );

    const newPendingContracts: ContractWrapperMap = {};
    for (const contract of contracts) {
      newPendingContracts[generateId(JSON.stringify(contract.metadataRaw))] = {
        // Remove large (e.g. bytecodes) and unnecessary (e.g. `solidityCompiler`) fields in SolidityCheckedContract before saving to the session. Essentially a SolidityCheckedContract only needs a few fields to be generated.
        contract: contract.exportConstructorArguments(),
      };
    }

    session.contractWrappers ||= {};
    for (const newId in newPendingContracts) {
      const newContractWrapper = newPendingContracts[newId];
      const oldContractWrapper = session.contractWrappers[newId];
      if (oldContractWrapper) {
        for (const path in newContractWrapper.contract.sources) {
          oldContractWrapper.contract.sources[path] =
            newContractWrapper.contract.sources[path];
          delete oldContractWrapper.contract.missing[path];
        }
        oldContractWrapper.contract.sources =
          newContractWrapper.contract.sources;
        oldContractWrapper.contract.missing =
          newContractWrapper.contract.missing;
      } else {
        session.contractWrappers[newId] = newContractWrapper;
      }
    }
    updateUnused(unused, session);
    logger.debug("Updated session", {
      sessionId: session.id,
      contracts: Object.keys(session.contractWrappers).map(
        (id) => session.contractWrappers[id].contract.name,
      ),
    });
  } catch (error) {
    const paths = pathBuffers.map((pb) => pb.path);
    updateUnused(paths, session);
  }
};

export async function addRemoteFile(
  query: QueryString.ParsedQs,
): Promise<PathBuffer[]> {
  logger.debug("addRemoteFile", { query });
  if (typeof query.url !== "string") {
    throw new BadRequestError("Query url must be a string");
  }
  let res;
  try {
    logger.debug("addRemoteFile Fetching", query.url);
    res = await fetch(query.url);
  } catch (err) {
    throw new BadRequestError("Couldn't fetch from " + query.url);
  }
  if (!res.ok) {
    logger.warn("addRemoteFile Failed Fetching", query.url, {
      status: res.status,
    });
    throw new BadRequestError("Couldn't fetch from " + query.url);
  }
  logger.debug("addRemoteFile Fetched", query.url, { status: res.status });
  // Save with the fileName exists on server response header.
  const fileName =
    res.headers.get("Content-Disposition")?.split("filename=")[1] ||
    query.url.substring(query.url.lastIndexOf("/") + 1) ||
    "file";
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return [
    {
      path: fileName,
      buffer,
    },
  ];
}

export const checkAndFetchMissing = async (
  contract: SolidityCheckedContract,
): Promise<void> => {
  if (!SolidityCheckedContract.isValid(contract)) {
    try {
      // Try to fetch missing files
      await SolidityCheckedContract.fetchMissing(contract);
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
  solc: ISolidityCompiler,
  vyper: IVyperCompiler,
  contractWrappers: ContractWrapperMap = {},
  session: Session,
  verificationService: VerificationService,
  storageService: StorageService,
  chainRepository: ChainRepository,
  dryRun: boolean = false,
): Promise<void> => {
  logger.debug("verifyContractsInSession", {
    sessionId: session.id,
    contracts: Object.keys(contractWrappers).map((id) => ({
      id,
      address: contractWrappers[id].address,
      chainId: contractWrappers[id].chainId,
    })),
  });
  for (const id in contractWrappers) {
    const contractWrapper = contractWrappers[id];

    logger.debug("verifyContractsInSession: iterate contract", {
      contractId: id,
      contract: contractWrapper.contract.name,
      address: contractWrapper.address,
      chainId: contractWrapper.chainId,
    });
    // Check if contract is already verified
    if (Boolean(contractWrapper.address) && Boolean(contractWrapper.chainId)) {
      const found = await isContractAlreadyPerfect(
        storageService,
        contractWrapper.address as string,
        contractWrapper.chainId as string,
      );

      if (found) {
        contractWrapper.status = found.runtimeMatch || "error";
        contractWrapper.statusMessage = found.message;
        contractWrapper.storageTimestamp = found.storageTimestamp;
        continue;
      }
    }

    const { address, chainId, contract, creatorTxHash } = contractWrapper;

    let checkedContract: AbstractCheckedContract;
    if (contract.language === Language.Solidity) {
      // The session saves the SolidityCheckedContract as a simple object, so we need to reinstantiate it
      checkedContract = createSolidityCheckedContract(
        solc,
        contract.metadata,
        contract.sources,
        contract.missing,
        contract.invalid,
      );
      await checkAndFetchMissing(checkedContract as SolidityCheckedContract);
    } else if (contract.language === Language.Vyper) {
      const compilationTarget = contract.metadata.settings.compilationTarget;
      const contractPath = Object.keys(compilationTarget)[0];
      const compilationSettings = JSON.parse(
        JSON.stringify(contract.metadata.settings),
      );
      delete compilationSettings.compilationTarget;
      const contractName = compilationTarget[contractPath];
      checkedContract = new VyperCheckedContract(
        vyper,
        contract.metadata.compiler.version,
        contractPath,
        contractName,
        compilationSettings,
        contract.sources,
      );
    } else {
      throw new BadRequestError("Unsupported language");
    }

    if (!isVerifiable(contractWrapper)) {
      logger.debug("verifyContractsInSession: not verifiable", {
        contractId: id,
      });
      continue;
    }

    let match: Match;
    try {
      match = await verificationService.verifyDeployed(
        checkedContract,
        chainRepository.sourcifyChainMap[chainId as string],
        address as string,
        creatorTxHash,
      );
      // Send to verification again with all source files.
      if (match.runtimeMatch === "extra-file-input-bug") {
        logger.debug(
          "verifyContractsInSession: extra-file-input-bug encountered",
          {
            contractId: id,
          },
        );
        // Session inputFiles are encoded base64. Why?
        const pathBufferInputFiles: PathBuffer[] = Object.values(
          session.inputFiles,
        ).map((base64file) => ({
          path: base64file.path,
          buffer: Buffer.from(base64file.content, FILE_ENCODING),
        }));
        const checkedContractWithAllSources = createSolidityCheckedContract(
          solc,
          contractWrapper.contract.metadata,
          contractWrapper.contract.sources,
          contractWrapper.contract.missing,
          contractWrapper.contract.invalid,
        );
        const contractWithAllSources = await useAllSources(
          checkedContractWithAllSources,
          pathBufferInputFiles,
        );
        const tempMatch = await verificationService.verifyDeployed(
          contractWithAllSources,
          chainRepository.sourcifyChainMap[chainId as string],
          address as string,
        );
        if (
          tempMatch.runtimeMatch === "perfect" ||
          tempMatch.runtimeMatch === "partial" ||
          tempMatch.creationMatch === "perfect" ||
          tempMatch.creationMatch === "partial"
        ) {
          match = tempMatch;
        } else if (tempMatch.runtimeMatch === "extra-file-input-bug") {
          throw new BadRequestError(
            "It seems your contract's metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618",
          );
        }
      }
    } catch (error: any) {
      match = {
        chainId: contractWrapper.chainId as string,
        runtimeMatch: null,
        creationMatch: null,
        address: contractWrapper.address as string,
        message: error.message,
      };
    }

    contractWrapper.status = getMatchStatus(match) || "error";
    contractWrapper.statusMessage = match.message;
    contractWrapper.storageTimestamp = match.storageTimestamp;
    if (dryRun) {
      logger.info("dryRun verification", {
        sessionId: session.id,
      });
      continue;
    }
    if (match.runtimeMatch || match.creationMatch) {
      await storageService.storeMatch(checkedContract, match);
    }
  }
};

export async function isContractAlreadyPerfect(
  storageService: StorageService,
  address: string,
  chainId: string,
): Promise<Match | false> {
  const result = await storageService.performServiceOperation(
    "checkByChainAndAddress",
    [address, chainId],
  );
  if (
    result.length != 0 &&
    result[0].runtimeMatch === "perfect" &&
    result[0].creationMatch === "perfect"
  ) {
    return result[0];
  } else {
    return false;
  }
}
