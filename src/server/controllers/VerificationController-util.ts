import { Request } from "express";
import { isAddress } from "ethers/lib/utils";
import { toChecksumAddress } from "web3-utils";
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
  useCompiler,
  JsonInput,
  Metadata,
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
import { etherscanAPIs } from "../../config";
import { AbiConstructor, AbiParameter } from "abitype";

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
  /* contextVariables?: {
    abiEncodedConstructorArguments?: string;
    msgSender?: string;
  }; */
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

export const verifyContractsInSession = async (
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
    if (match.status) {
      await repositoryService.storeMatch(checkedContract, match);
    }
  }
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

export const isEtherscanSolcJsonInput = (sourceCodeObject: string) => {
  if (sourceCodeObject.startsWith("{{")) {
    return true;
  }
  return false;
};

export const isEtherscanMultipleFilesObject = (sourceCodeObject: string) => {
  try {
    return Object.keys(JSON.parse(sourceCodeObject)).length > 0;
  } catch (e) {
    return false;
  }
};

export const parseSolcJsonInput = (sourceCodeObject: string) => {
  return JSON.parse(sourceCodeObject.slice(1, -1));
};

export const getSolcJsonInputFromEtherscanResult = (
  etherscanResult: EtherscanResult,
  sources: any
): JsonInput => {
  const generatedSettings = {
    optimizer: {
      enabled: etherscanResult.OptimizationUsed === "1",
      runs: parseInt(etherscanResult.Runs),
    },
    outputSelection: {
      "*": {
        "*": ["metadata", "evm.deployedBytecode.object"],
      },
    },
    evmVersion:
      etherscanResult.EVMVersion.toLowerCase() !== "default"
        ? etherscanResult.EVMVersion
        : undefined,
    libraries: {}, // TODO: Check the library format
  };
  const solcJsonInput = {
    language: "Solidity",
    sources,
    settings: generatedSettings,
  };
  return solcJsonInput;
};

export const findContractPathFromContractName = (
  contracts: any,
  contractName: string
): string | null => {
  for (const key of Object.keys(contracts)) {
    const contractsList = contracts[key];
    if (Object.keys(contractsList).includes(contractName)) {
      return key;
    }
  }
  return null;
};

export const processRequestFromEtherscan = async (
  chain: string,
  address: string
): Promise<any> => {
  if (Object.keys(etherscanAPIs).includes(chain) === false) {
    throw new BadRequestError(
      `Requested chain ${chain} is not supported for importing from Etherscan`
    );
  }

  const url = `${etherscanAPIs[chain].apiURL}/api?module=contract&action=getsourcecode&address=${address}&apikey=${etherscanAPIs[chain].apiKey}`;

  const response = await fetch(url);
  const resultJson = await response.json();
  if (
    resultJson.message === "NOTOK" &&
    resultJson.result.includes("Max rate limit reached")
  ) {
    throw new BadRequestError("Etherscan API rate limit reached, try later");
  }

  if (resultJson.message === "NOTOK") {
    throw new BadRequestError(
      "Error in Etherscan API response. Result message: " + resultJson.message
    );
  }
  if (resultJson.result[0].SourceCode === "") {
    throw new BadRequestError("This contract is not verified on Etherscan");
  }
  const contractResultJson = resultJson.result[0];
  const sourceCodeObject = contractResultJson.SourceCode;
  const compilerVersion =
    contractResultJson.CompilerVersion.charAt(0) === "v"
      ? contractResultJson.CompilerVersion.slice(1)
      : contractResultJson.CompilerVersion;
  // TODO: this is not used by lib-sourcify's useCompiler
  const contractName = contractResultJson.ContractName;

  let solcJsonInput: JsonInput;
  // SourceCode can be the Solidity code if there is only one contract file, or the json object if there are multiple files
  if (isEtherscanSolcJsonInput(sourceCodeObject)) {
    solcJsonInput = parseSolcJsonInput(sourceCodeObject);

    if (solcJsonInput?.settings) {
      // Tell compiler to output metadata and bytecode
      solcJsonInput.settings.outputSelection["*"]["*"] = [
        "metadata",
        "evm.deployedBytecode.object",
      ];
    }
  } else if (isEtherscanMultipleFilesObject(sourceCodeObject)) {
    solcJsonInput = getSolcJsonInputFromEtherscanResult(
      contractResultJson,
      JSON.parse(sourceCodeObject)
    );
  } else {
    const contractPath = contractResultJson.ContractName + ".sol";
    const sources = {
      [contractPath]: {
        content: sourceCodeObject,
      },
    };
    solcJsonInput = getSolcJsonInputFromEtherscanResult(
      contractResultJson,
      sources
    );
  }

  if (!solcJsonInput) {
    throw new BadRequestError(
      "Sourcify cannot generate the solcJsonInput from Etherscan result"
    );
  }

  return {
    compilerVersion,
    solcJsonInput,
    contractName,
  };
};

export const getMetadataFromCompiler = async (
  compilerVersion: string,
  solcJsonInput: JsonInput,
  contractName: string
): Promise<Metadata> => {
  const compilationResult = await useCompiler(compilerVersion, solcJsonInput);

  const contractPath = findContractPathFromContractName(
    compilationResult.contracts,
    contractName
  );

  if (!contractPath) {
    throw new BadRequestError(
      "This contract was verified with errors on Etherscan"
    );
  }

  return JSON.parse(
    compilationResult.contracts[contractPath][contractName].metadata
  );
};

export const getMappedSourcesFromJsonInput = (jsonInput: JsonInput) => {
  const mappedSources: any = {};
  for (const name in jsonInput.sources) {
    const source = jsonInput.sources[name];
    if (source.content) {
      mappedSources[name] = source.content;
    }
  }
  return mappedSources;
};

export const stringToBase64 = (str: string): string => {
  return Buffer.from(str, "utf8").toString("base64");
};

type Create2RequestBody = {
  deployerAddress: string;
  salt: string;
  abiEncodedConstructorArguments?: string;
  files: {
    [key: string]: string;
  };
  create2Address: string;
  clientToken?: string;
};

// Override "any" typed Request.body
export interface Create2VerifyRequest extends Request {
  body: Create2RequestBody;
}

export interface SessionCreate2VerifyRequest extends Request {
  body: Create2RequestBody & {
    verificationId: string;
  };
}

export interface SessionCreate2VerifyRequest extends Request {
  body: Create2RequestBody & {
    verificationId: string;
  };
}
