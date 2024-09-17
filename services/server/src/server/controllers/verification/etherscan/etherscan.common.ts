import { BadRequestError, NotFoundError } from "../../../../common/errors";
import {
  JsonInput,
  Metadata,
  SourcifyChain,
  findContractPathFromContractName,
} from "@ethereum-sourcify/lib-sourcify";
import { TooManyRequests } from "../../../../common/errors/TooManyRequests";
import { BadGatewayError } from "../../../../common/errors/BadGatewayError";
import { solc } from "../verification.common";
import logger from "../../../../common/logger";

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

export const parseSolcJsonInput = (sourceCodeObject: string) => {
  return JSON.parse(sourceCodeObject.slice(1, -1));
};

export const isEtherscanMultipleFilesObject = (sourceCodeObject: string) => {
  try {
    return Object.keys(JSON.parse(sourceCodeObject)).length > 0;
  } catch (e) {
    return false;
  }
};

export const isEtherscanSolcJsonInput = (sourceCodeObject: string) => {
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

export const processRequestFromEtherscan = async (
  sourcifyChain: SourcifyChain,
  address: string,
  apiKey?: string,
): Promise<any> => {
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
  const contractResultJson = resultJson.result[0];
  const sourceCodeObject = contractResultJson.SourceCode;

  if (contractResultJson.CompilerVersion.startsWith("vyper")) {
    throw new Error("Sourcify currently cannot verify Vyper contracts");
  }

  const compilerVersion =
    contractResultJson.CompilerVersion.charAt(0) === "v"
      ? contractResultJson.CompilerVersion.slice(1)
      : contractResultJson.CompilerVersion;
  // TODO: this is not used by lib-sourcify's useCompiler
  const contractName = contractResultJson.ContractName;

  let solcJsonInput: JsonInput;
  // SourceCode can be the Solidity code if there is only one contract file, or the json object if there are multiple files
  if (isEtherscanSolcJsonInput(sourceCodeObject)) {
    logger.debug("Etherscan solcJsonInput contract found", {
      chainId: sourcifyChain.chainId,
      address,
      secretUrl,
    });
    solcJsonInput = parseSolcJsonInput(sourceCodeObject);

    if (solcJsonInput?.settings) {
      // Tell compiler to output metadata and bytecode
      solcJsonInput.settings.outputSelection["*"]["*"] = [
        "metadata",
        "evm.deployedBytecode.object",
      ];
    }
  } else if (isEtherscanMultipleFilesObject(sourceCodeObject)) {
    logger.debug("Etherscan multiple file contract found", {
      chainId: sourcifyChain.chainId,
      address,
      secretUrl,
    });
    solcJsonInput = getSolcJsonInputFromEtherscanResult(
      contractResultJson,
      JSON.parse(sourceCodeObject),
    );
  } else {
    logger.debug("Etherscan single file contract found", {
      chainId: sourcifyChain.chainId,
      address,
      secretUrl,
    });
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
    logger.info("Etherscan API - no solcJsonInput", {
      chainId: sourcifyChain.chainId,
      address,
      secretUrl,
    });
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

export const getMetadataFromCompiler = async (
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
