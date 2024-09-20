import {
  SourcifyChain,
  SourcifyChainMap,
  SourcifyChainsExtensionsObject,
  Chain,
  AlchemyInfuraRPC,
  FetchRequestRPC,
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

export
const LOCAL_CHAINS: SourcifyChain[] = [
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
  rpc: Array<string | AlchemyInfuraRPC | FetchRequestRPC>,
) {
  return rpc.map((rpc) => {
    // simple url
    if (typeof rpc === "string") {
      return rpc;
    }
    // Fill in the api keys
    else if (rpc.type === "Alchemy") {
      return rpc.url.replace(
        "{ALCHEMY_API_KEY}",
        process.env[rpc.apiKeyEnvName] || process.env["ALCHEMY_API_KEY"] || "",
      );
    } else if (rpc.type === "Infura") {
      return rpc.url.replace(
        "{INFURA_API_KEY}",
        process.env[rpc.apiKeyEnvName] || "",
      );
    }
    // Build ethers.js FetchRequest object for custom rpcs with auth headers
    else if (rpc.type === "FetchRequest") {
      const ethersFetchReq = new FetchRequest(rpc.url);
      ethersFetchReq.setHeader("Content-Type", "application/json");
      const headers = rpc.headers;
      if (headers) {
        headers.forEach(({ headerName, headerEnvName }) => {
          const headerValue = process.env[headerEnvName];
          ethersFetchReq.setHeader(headerName, headerValue || "");
        });
      }
      return ethersFetchReq;
    }
    throw new Error(`Invalid rpc type: ${rpc.type}`);
  });
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
    // sourcifyExtension is spread later to overwrite chains.json values, rpc specifically
    const sourcifyChain = new SourcifyChain({
      ...chain,
      ...sourcifyExtension,
      rpc: sourcifyExtension.rpc
        ? buildCustomRpcs(sourcifyExtension.rpc)
        : chain.rpc, // avoid rpc ending up as undefined
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
      sourcifyChainsMap[chainId] = new SourcifyChain({
        name: chain.sourcifyName,
        chainId: parseInt(chainId),
        supported: chain.supported,
        rpc: buildCustomRpcs(chain.rpc),
      });
    });
  }
}

export { sourcifyChainsMap };
