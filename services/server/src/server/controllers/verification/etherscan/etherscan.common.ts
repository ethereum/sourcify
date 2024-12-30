import { BadRequestError, NotFoundError } from "../../../../common/errors";
import {
  ISolidityCompiler,
  JsonInput,
  Metadata,
  SourcifyChain,
  VyperJsonInput,
  findContractPathFromContractName,
} from "@ethereum-sourcify/lib-sourcify";
import { TooManyRequests } from "../../../../common/errors/TooManyRequests";
import { BadGatewayError } from "../../../../common/errors/BadGatewayError";
import logger from "../../../../common/logger";

interface VyperVersion {
  compiler_version: string;
  tag: string;
}

interface VyperVersionCache {
  versions: VyperVersion[];
  lastFetch: number;
}

let vyperVersionCache: VyperVersionCache | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour default

// TODO: would it be better to get the versionCache from https://api.github.com/repos/vyperlang/vyper/releases ?
//       On GitHub releases, the new version is 0.4.1 is included which is not in the hardhat link below.
export const getVyperCompilerVersion = async (
  compilerString: string,
  cacheDurationMs: number = CACHE_DURATION_MS,
): Promise<string | undefined> => {
  const now = Date.now();

  // Check if cache needs refresh
  if (
    !vyperVersionCache ||
    now - vyperVersionCache.lastFetch > cacheDurationMs
  ) {
    try {
      const response = await fetch(
        "https://vyper-releases-mirror.hardhat.org/list.json",
      );
      const versions = await response.json();
      vyperVersionCache = {
        versions: versions.map((version: any) => ({
          compiler_version: version.assets[0]?.name
            .replace("vyper.", "")
            .replace(".darwin", "")
            .replace(".linux", "")
            .replace(".windows.exe", ""),
          tag: version.tag_name.substring(1),
        })),
        lastFetch: now,
      };
    } catch (error) {
      logger.error("Failed to fetch Vyper versions", { error });
      // If cache exists but is stale, use it rather than failing
      if (vyperVersionCache) {
        logger.warn("Using stale Vyper versions cache");
      } else {
        throw error;
      }
    }
  }

  if (!vyperVersionCache) {
    return undefined;
  }

  const versionNumber = compilerString.split(":")[1];
  return vyperVersionCache.versions.find(
    (version) => version.tag === versionNumber,
  )?.compiler_version;
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

export const parseJsonInput = (sourceCodeObject: string) => {
  return JSON.parse(sourceCodeObject.slice(1, -1));
};

export const isEtherscanMultipleFilesObject = (sourceCodeObject: string) => {
  try {
    return Object.keys(JSON.parse(sourceCodeObject)).length > 0;
  } catch (e) {
    return false;
  }
};

export const isEtherscanJsonInput = (sourceCodeObject: string) => {
  if (sourceCodeObject.startsWith("{{")) {
    return true;
  }
  return false;
};

export const getSolcJsonInputFromEtherscanResult = (
  etherscanResult: EtherscanResult,
  sources: any,
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

export const getVyperJsonInputFromEtherscanResult = (
  etherscanResult: EtherscanResult,
  sources: VyperJsonInput["sources"],
): VyperJsonInput => {
  const generatedSettings = {
    outputSelection: {
      "*": ["evm.deployedBytecode.object"],
    },
    evmVersion:
      etherscanResult.EVMVersion !== "Default"
        ? (etherscanResult.EVMVersion as any)
        : undefined,
    search_paths: ["."],
  };
  return {
    language: "Vyper",
    sources,
    settings: generatedSettings,
  };
};

export interface ProcessedEtherscanSolidityResult {
  compilerVersion: string;
  solcJsonInput: JsonInput;
  contractName: string;
}

export interface ProcessedEtherscanVyperResult {
  compilerVersion: string;
  vyperJsonInput: VyperJsonInput;
  contractPath: string;
  contractName: string;
}

export interface ProcessedEtherscanResult {
  vyperResult?: ProcessedEtherscanVyperResult;
  solidityResult?: ProcessedEtherscanSolidityResult;
}

export const processRequestFromEtherscan = async (
  sourcifyChain: SourcifyChain,
  address: string,
  apiKey?: string,
): Promise<ProcessedEtherscanResult> => {
  if (!sourcifyChain.etherscanApi) {
    throw new BadRequestError(
      `Requested chain ${sourcifyChain.chainId} is not supported for importing from Etherscan`,
    );
  }

  const url = `${sourcifyChain.etherscanApi.apiURL}/api?module=contract&action=getsourcecode&address=${address}`;
  const usedApiKey =
    apiKey || process.env[sourcifyChain.etherscanApi.apiKeyEnvName || ""];
  let response;
  const secretUrl = `${url}&apikey=${usedApiKey || ""}`;
  logger.debug("Fetching from Etherscan", {
    secretUrl,
    chainId: sourcifyChain.chainId,
    address,
  });
  try {
    response = await fetch(secretUrl);
  } catch (e: any) {
    throw new BadGatewayError(
      `Request to ${url}&apiKey=XXX failed with code ${e.code}`,
    );
  }
  logger.debug("Fetched from Etherscan", {
    secretUrl,
    chainId: sourcifyChain.chainId,
    address,
  });

  if (!response.ok) {
    logger.warn("Etherscan API error", {
      secretUrl,
      chainId: sourcifyChain.chainId,
      address,
      response: JSON.stringify(response),
    });
    throw new BadRequestError(
      "Error in Etherscan API response. Status code: " + response.status,
    );
  }

  const resultJson = await response.json();

  if (
    resultJson.message === "NOTOK" &&
    resultJson.result.includes("rate limit reached")
  ) {
    logger.info("Etherscan Rate Limit", {
      secretUrl,
      chainId: sourcifyChain.chainId,
      address,
      resultJson: JSON.stringify(resultJson),
    });
    throw new TooManyRequests("Etherscan API rate limit reached, try later");
  }

  if (resultJson.message === "NOTOK") {
    logger.error("Etherscan API error", {
      secretUrl,
      chainId: sourcifyChain.chainId,
      address,
      resultJson: JSON.stringify(resultJson),
    });
    throw new BadGatewayError(
      "Error in Etherscan API response. Result message: " + resultJson.result,
    );
  }
  if (resultJson.result[0].SourceCode === "") {
    logger.info("Contract not found on Etherscan", {
      chainId: sourcifyChain.chainId,
      address,
      secretUrl,
    });
    throw new NotFoundError("This contract is not verified on Etherscan");
  }

  const contractResultJson = resultJson.result[0] as EtherscanResult;

  if (contractResultJson.CompilerVersion.startsWith("vyper")) {
    return {
      vyperResult: await processVyperResultFromEtherscan(contractResultJson),
    };
  } else {
    return {
      solidityResult: processSolidityResultFromEtherscan(contractResultJson),
    };
  }
};

const processSolidityResultFromEtherscan = (
  contractResultJson: EtherscanResult,
): ProcessedEtherscanSolidityResult => {
  const sourceCodeObject = contractResultJson.SourceCode;
  // TODO: this is not used by lib-sourcify's useSolidityCompiler
  const contractName = contractResultJson.ContractName;

  const compilerVersion =
    contractResultJson.CompilerVersion.charAt(0) === "v"
      ? contractResultJson.CompilerVersion.slice(1)
      : contractResultJson.CompilerVersion;

  let solcJsonInput: JsonInput;
  // SourceCode can be the Solidity code if there is only one contract file, or the json object if there are multiple files
  if (isEtherscanJsonInput(sourceCodeObject)) {
    logger.debug("Etherscan solcJsonInput contract found");
    solcJsonInput = parseJsonInput(sourceCodeObject);

    if (solcJsonInput?.settings) {
      // Tell compiler to output metadata and bytecode
      solcJsonInput.settings.outputSelection["*"]["*"] = [
        "metadata",
        "evm.deployedBytecode.object",
      ];
    }
  } else if (isEtherscanMultipleFilesObject(sourceCodeObject)) {
    logger.debug("Etherscan Solidity multiple file contract found");
    solcJsonInput = getSolcJsonInputFromEtherscanResult(
      contractResultJson,
      JSON.parse(sourceCodeObject),
    );
  } else {
    logger.debug("Etherscan Solidity single file contract found");
    const contractPath = contractResultJson.ContractName + ".sol";
    const sources = {
      [contractPath]: {
        content: sourceCodeObject,
      },
    };
    solcJsonInput = getSolcJsonInputFromEtherscanResult(
      contractResultJson,
      sources,
    );
  }

  if (!solcJsonInput) {
    logger.info("Etherscan API - no solcJsonInput");
    throw new BadRequestError(
      "Sourcify cannot generate the solcJsonInput from Etherscan result",
    );
  }

  return {
    compilerVersion,
    solcJsonInput,
    contractName,
  };
};

const processVyperResultFromEtherscan = async (
  contractResultJson: EtherscanResult,
): Promise<ProcessedEtherscanVyperResult> => {
  const sourceCodeProperty = contractResultJson.SourceCode;
  let contractName = contractResultJson.ContractName;

  const compilerVersion = await getVyperCompilerVersion(
    contractResultJson.CompilerVersion,
  );
  if (!compilerVersion) {
    throw new BadRequestError(
      "Could not map the Vyper version from Etherscan to a valid compiler version",
    );
  }

  let contractPath: string;
  let vyperJsonInput: VyperJsonInput;
  if (isEtherscanJsonInput(sourceCodeProperty)) {
    logger.debug("Etherscan vyperJsonInput contract found");
    const parsedJsonInput = parseJsonInput(sourceCodeProperty);

    // We cannot use the contractName to find the contract path because the contractName is sometimes different
    contractPath = Object.keys(parsedJsonInput.settings.outputSelection)[0];
    // We need to use the name from the contractPath because VyperCheckedContract uses it for selecting the compiler output
    contractName = contractPath.split("/").pop()!.split(".")[0];
    // todo/ check if this above is necessary

    if (contractPath === "*") {
      throw new BadRequestError(
        "This Vyper contracts is not verifiable by using Import From Etherscan",
      );
    }

    vyperJsonInput = {
      language: "Vyper",
      sources: parsedJsonInput.sources,
      settings: parsedJsonInput.settings,
    };
  } else {
    logger.debug("Etherscan Vyper single file contract found");
    contractPath = contractResultJson.ContractName + ".vy";
    const sources = {
      [contractPath]: { content: sourceCodeProperty },
    };
    //todo/ check if spaces are treated correctly

    // TODO: in this case, we encounter the following error:
    //   [{"component":"compiler","message":"substring not found","severity":"error","sourceLocation":{"file":"LiquidityGaugeV6.vy"},"type":"ValueError"}]
    vyperJsonInput = getVyperJsonInputFromEtherscanResult(
      contractResultJson,
      sources,
    );
  }
  return {
    compilerVersion,
    vyperJsonInput,
    contractPath,
    contractName,
  };
};

export const getMetadataFromCompiler = async (
  solc: ISolidityCompiler,
  compilerVersion: string,
  solcJsonInput: JsonInput,
  contractName: string,
): Promise<Metadata> => {
  const compilationResult = await solc.compile(compilerVersion, solcJsonInput);

  const contractPath = findContractPathFromContractName(
    compilationResult.contracts,
    contractName,
  );

  if (!contractPath) {
    throw new BadRequestError(
      "This contract was verified with errors on Etherscan",
    );
  }

  return JSON.parse(
    compilationResult.contracts[contractPath][contractName].metadata,
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
