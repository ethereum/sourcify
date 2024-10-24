import {
  SourcifyChain,
  SourcifyChainMap,
  SourcifyChainsExtensionsObject,
  Chain,
  APIKeyRPC,
  FetchRequestRPC,
  BaseRPC,
  TraceSupportedRPC,
} from "@ethereum-sourcify/lib-sourcify";
import { FetchRequest } from "ethers";
import chainsRaw from "./chains.json";
import rawSourcifyChainExtentions from "./sourcify-chains-default.json";
import logger from "./common/logger";
import fs from "fs";
import path from "path";

let sourcifyChainsExtensions: SourcifyChainsExtensionsObject = {};

// If sourcify-chains.json exists, override sourcify-chains-default.json
if (fs.existsSync(path.resolve(__dirname, "./sourcify-chains.json"))) {
  logger.warn(
    "Overriding default chains: using sourcify-chains.json instead of sourcify-chains-default.json",
  );
  const rawSourcifyChainExtentionsFromFile = fs.readFileSync(
    path.resolve(__dirname, "./sourcify-chains.json"),
    "utf8",
  );
  sourcifyChainsExtensions = JSON.parse(
    rawSourcifyChainExtentionsFromFile,
  ) as SourcifyChainsExtensionsObject;
}
// sourcify-chains-default.json
else {
  sourcifyChainsExtensions =
    rawSourcifyChainExtentions as SourcifyChainsExtensionsObject;
}

// chains.json from ethereum-lists (chainId.network/chains.json)
const allChains = chainsRaw as Chain[];

export const LOCAL_CHAINS: SourcifyChain[] = [
  new SourcifyChain({
    name: "Ganache Localhost",
    shortName: "Ganache",
    chainId: 1337,
    faucets: [],
    infoURL: "localhost",
    nativeCurrency: { name: "localETH", symbol: "localETH", decimals: 18 },
    network: "testnet",
    networkId: 1337,
    rpc: [`http://localhost:8545`],
    supported: true,
  }),
  new SourcifyChain({
    name: "Hardhat Network Localhost",
    shortName: "Hardhat Network",
    chainId: 31337,
    faucets: [],
    infoURL: "localhost",
    nativeCurrency: { name: "localETH", symbol: "localETH", decimals: 18 },
    network: "testnet",
    networkId: 31337,
    rpc: [`http://localhost:8545`],
    supported: true,
  }),
];

/**
 * Function to take the rpc format in sourcify-chains.json and convert it to the format SourcifyChain expects.
 * SourcifyChain expects  url strings or ethers.js FetchRequest objects.
 */
function buildCustomRpcs(
  sourcifyRpcs: Array<string | BaseRPC | APIKeyRPC | FetchRequestRPC>,
) {
  const traceSupportedRPCs: TraceSupportedRPC[] = [];
  const rpc: (string | FetchRequest)[] = [];
  const rpcWithoutApiKeys: string[] = [];
  sourcifyRpcs.forEach((sourcifyRpc, index) => {
    // simple url, can't have traceSupport
    if (typeof sourcifyRpc === "string") {
      rpc.push(sourcifyRpc);
      rpcWithoutApiKeys.push(sourcifyRpc);
      return;
    }

    if (sourcifyRpc.traceSupport) {
      traceSupportedRPCs.push({
        type: sourcifyRpc.traceSupport,
        index,
      });
    }

    if (sourcifyRpc.type === "BaseRPC") {
      rpc.push(sourcifyRpc.url);
      rpcWithoutApiKeys.push(sourcifyRpc.url);
      return;
    }
    // Fill in the api keys
    else if (sourcifyRpc.type === "APIKeyRPC") {
      const apiKey =
        process.env[sourcifyRpc.apiKeyEnvName] || process.env["API_KEY"] || "";
      if (!apiKey) {
        throw new Error(`API key not found for ${sourcifyRpc.apiKeyEnvName}`);
      }
      const subDomain = process.env[sourcifyRpc.subDomainEnvName || ""];
      const url = sourcifyRpc.url
        .replace("{API_KEY}", apiKey)
        .replace("{SUBDOMAIN}", subDomain);
      rpc.push(url);
      rpcWithoutApiKeys.push(sourcifyRpc.url);
      return;
    }
    // Build ethers.js FetchRequest object for custom rpcs with auth headers
    else if (sourcifyRpc.type === "FetchRequest") {
      const ethersFetchReq = new FetchRequest(sourcifyRpc.url);
      ethersFetchReq.setHeader("Content-Type", "application/json");
      const headers = sourcifyRpc.headers;
      if (headers) {
        headers.forEach(({ headerName, headerEnvName }) => {
          const headerValue = process.env[headerEnvName];
          ethersFetchReq.setHeader(headerName, headerValue || "");
        });
      }
      rpc.push(ethersFetchReq);
      rpcWithoutApiKeys.push(sourcifyRpc.url);
      return;
    }
    throw new Error(`Invalid rpc type: ${JSON.stringify(sourcifyRpc)}`);
  });
  return {
    rpc,
    rpcWithoutApiKeys,
    traceSupportedRPCs:
      traceSupportedRPCs.length > 0 ? traceSupportedRPCs : undefined,
  };
}

const sourcifyChainsMap: SourcifyChainMap = {};

// Add test chains too if developing or testing
if (process.env.NODE_ENV !== "production") {
  for (const chain of LOCAL_CHAINS) {
    sourcifyChainsMap[chain.chainId.toString()] = chain;
  }
}

// iterate over chainid.network's chains.json file and get the chains included in sourcify-chains.json.
// Merge the chains.json object with the values from sourcify-chains.json
// Must iterate over all chains because it's not a mapping but an array.
for (const i in allChains) {
  const chain = allChains[i];
  const chainId = chain.chainId;
  if (chainId in sourcifyChainsMap) {
    // Don't throw on local chains in development, override the chain.json item
    if (
      process.env.NODE_ENV !== "production" &&
      LOCAL_CHAINS.map((c) => c.chainId).includes(chainId)
    ) {
      continue;
    }
    const err = `Corrupt chains file (chains.json): multiple chains have the same chainId: ${chainId}`;
    throw new Error(err);
  }

  if (chainId in sourcifyChainsExtensions) {
    const sourcifyExtension = sourcifyChainsExtensions[chainId];
    const { rpc, rpcWithoutApiKeys, traceSupportedRPCs } = buildCustomRpcs(
      sourcifyExtension.rpc || chain.rpc,
    );
    // sourcifyExtension is spread later to overwrite chains.json values, rpc specifically
    const sourcifyChain = new SourcifyChain({
      ...chain,
      ...sourcifyExtension,
      rpc,
      rpcWithoutApiKeys,
      traceSupportedRPCs,
    });
    sourcifyChainsMap[chainId] = sourcifyChain;
  }
}

// Check if all chains in sourcify-chains.json are in chains.json
const missingChains = [];
for (const chainId in sourcifyChainsExtensions) {
  if (!sourcifyChainsMap[chainId]) {
    missingChains.push(chainId);
  }
}
if (missingChains.length > 0) {
  // Don't let CircleCI pass for the main repo if sourcify-chains.json has chains that are not in chains.json
  if (process.env.CIRCLE_PROJECT_REPONAME === "sourcify") {
    throw new Error(
      `Some of the chains in sourcify-chains.json are not in chains.json: ${missingChains.join(
        ",",
      )}`,
    );
  }
  // Don't throw for forks or others running Sourcify, instead add them to sourcifyChainsMap
  else {
    logger.warn(
      `Some of the chains in sourcify-chains.json are not in chains.json`,
      missingChains,
    );
    missingChains.forEach((chainId) => {
      const chain = sourcifyChainsExtensions[chainId];
      if (!chain.rpc) {
        throw new Error(
          `Chain ${chainId} is missing rpc in sourcify-chains.json`,
        );
      }
      const { rpc, rpcWithoutApiKeys, traceSupportedRPCs } = buildCustomRpcs(
        chain.rpc,
      );
      sourcifyChainsMap[chainId] = new SourcifyChain({
        name: chain.sourcifyName,
        chainId: parseInt(chainId),
        supported: chain.supported,
        rpc,
        rpcWithoutApiKeys,
        traceSupportedRPCs,
      });
    });
  }
}

export { sourcifyChainsMap };
