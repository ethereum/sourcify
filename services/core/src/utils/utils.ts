import semver from "semver";
import * as chainsRaw from "../chains.json";
import { SourcifyEventManager } from "../services/EventManager";
import sourcifyChains from "../sourcify-chains";
import { StringMap, ReformattedMetadata, Chain } from "./types";
const chains = chainsRaw as any;

type ChainMap = {
  [chainId: string]: Chain;
};

const TEST_CHAINS: Chain[] = [
  {
    name: "Localhost",
    shortName: "Localhost",
    chainId: 0,
    faucets: [],
    infoURL: "localhost",
    nativeCurrency: { name: "localETH", symbol: "localETH", decimals: 18 },
    network: "testnet",
    networkId: 0,
    rpc: [`http://localhost:8545`],
    supported: true,
    monitored: true,
  },
];

const chainMap: ChainMap = {};
let chainArray: Chain[] = [];
let supportedChainArray: Chain[] = [];
let monitoredChainArray: Chain[] = [];

// Add test chains too if testing
if (process.env.TESTING == "true") {
  for (const chain of TEST_CHAINS) {
    chainMap[chain.chainId.toString()] = chain;
  }
}

// iterate over chainid.network's chains.json file and get the chains included in sourcify.
// Merge the chains.json object with the values from sourcify-chains.ts
for (const i in chains) {
  const chain = chains[i];
  const chainId = chain.chainId;
  if (chainId in chainMap) {
    const err = `Corrupt chains file (chains.json): multiple chains have the same chainId: ${chainId}`;
    throw new Error(err);
  }

  if (chainId in sourcifyChains) {
    const sourcifyData = sourcifyChains[chainId];
    Object.assign(chain, sourcifyData);
    chainMap[chainId] = chain;
  }
}

chainArray = getSortedChainsArray(chainMap);
supportedChainArray = chainArray.filter((chain) => chain.supported);
monitoredChainArray = chainArray.filter((chain) => chain.monitored);

function getPrimarySortKey(chain: any) {
  return chain.title || chain.name;
}

// Gets the chainsMap, sorts the chains, returns Chain array.
export function getSortedChainsArray(chainMap: ChainMap): Chain[] {
  const chainsArray = Object.values(chainMap);
  // Have Ethereum chains on top.
  const ethereumChainIds = [1, 4, 5, 11155111];
  const etherumChains = ethereumChainIds.map((id) => chainMap[id]);
  // Others, sorted alphabetically
  const otherChains = chainsArray
    .filter((chain) => ![1, 4, 5, 11155111].includes(chain.chainId))
    .sort((a, b) =>
      getPrimarySortKey(a) > getPrimarySortKey(b)
        ? 1
        : getPrimarySortKey(b) > getPrimarySortKey(a)
        ? -1
        : 0
    );

  const sortedChains = etherumChains.concat(otherChains);
  return sortedChains;
}

export function getSourcifyChains(): Chain[] {
  return chainArray;
}

export function getSupportedChains(): Chain[] {
  return supportedChainArray;
}

export function getMonitoredChains(): Chain[] {
  return monitoredChainArray;
}

export function getTestChains(): Chain[] {
  return TEST_CHAINS;
}

/**
 * Checks whether the provided chain identifier is a legal chainId and is supported.
 * Throws if not.
 *
 * @returns the same provided chainId if valid
 * @throws Error if not a valid chainId
 * @param chain chain
 */
export function checkChainId(chain: string): string {
  if (!(chain in chainMap && chainMap[chain].supported)) {
    throw new Error(`Chain ${chain} not supported!`);
  }

  return chain;
}

/**
 * Checks whether the provided object contains any keys or not.
 * @param obj The object whose emptiness is tested.
 * @returns true if any keys present; false otherwise
 */
export function isEmpty(obj: object): boolean {
  return !Object.keys(obj).length && obj.constructor === Object;
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
export function createJsonInputFromMetadata(
  metadata: any,
  sources: StringMap
): ReformattedMetadata {
  const solcJsonInput: any = {};
  let fileName = "";
  let contractName = "";

  solcJsonInput.settings = JSON.parse(JSON.stringify(metadata.settings));

  if (
    !metadata.settings ||
    !metadata.settings.compilationTarget ||
    Object.keys(metadata.settings.compilationTarget).length != 1
  ) {
    const error = new Error(
      "createJsonInputFromMetadata: Invalid compilationTarget"
    );
    SourcifyEventManager.trigger("Core.Error", {
      message: error.message,
      stack: error.stack,
      details: {
        metadata,
        sources,
      },
    });
    throw error;
  }

  for (fileName in metadata.settings.compilationTarget) {
    contractName = metadata.settings.compilationTarget[fileName];
  }

  delete solcJsonInput.settings.compilationTarget;

  // Check inliner bug for below versions https://github.com/ethereum/sourcify/issues/640
  const versions = ["0.8.2", "0.8.3", "0.8.4"];
  const coercedVersion = semver.coerce(metadata.compiler.version)?.version;

  const affectedVersions = versions.filter((version) =>
    semver.eq(version, coercedVersion || "")
  );
  if (affectedVersions.length > 0) {
    if (solcJsonInput.settings?.optimizer?.details?.inliner) {
      delete solcJsonInput.settings.optimizer.details.inliner;
    }
  }

  solcJsonInput.sources = {};
  for (const source in sources) {
    solcJsonInput.sources[source] = { content: sources[source] };
  }

  solcJsonInput.language = metadata.language;
  solcJsonInput.settings.metadata = solcJsonInput.settings.metadata || {};
  solcJsonInput.settings.outputSelection =
    solcJsonInput.settings.outputSelection || {};
  solcJsonInput.settings.outputSelection[fileName] =
    solcJsonInput.settings.outputSelection[fileName] || {};

  solcJsonInput.settings.outputSelection[fileName][contractName] = [
    "evm.bytecode.object",
    "evm.deployedBytecode.object",
    "metadata",
  ];

  solcJsonInput.settings.libraries = { "": metadata.settings.libraries || {} };

  return { solcJsonInput, fileName, contractName };
}
