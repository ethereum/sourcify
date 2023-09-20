import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";
import assert from "assert";
import { EventEmitter } from "stream";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import logger from "./logger";
import ChainMonitor from "./ChainMonitor";
import {
  KnownDecentralizedStorageFetchers,
  MonitorConfig,
  PassedMonitorConfig,
} from "./types";
import dotenv from "dotenv";
import { FetchRequest } from "ethers";

dotenv.config();

const defaultConfig: MonitorConfig = {
  decentralizedStorages: {
    ipfs: {
      enabled: true,
      gateways: ["https://ipfs.io/ipfs/"],
      timeout: 30000,
      interval: 1000,
      retries: 5,
    },
  },
  sourcifyServerURLs: ["https://sourcify.dev/server/"],
  defaultChainConfig: {
    startBlock: undefined,
    blockInterval: 10000,
    blockIntervalFactor: 1.1,
    blockIntervalUpperLimit: 300000,
    blockIntervalLowerLimit: 100,
    bytecodeInterval: 5000,
    bytecodeNumberOfTries: 5,
  },
};

export default class Monitor extends EventEmitter {
  private chainMonitors: ChainMonitor[];
  private sourceFetchers: KnownDecentralizedStorageFetchers = {};
  private config: MonitorConfig;

  constructor(
    chainsToMonitor:
      | { chainId: number; rpc: string[]; name: string }[]
      | SourcifyChain[],
    passedConfig?: PassedMonitorConfig
  ) {
    super();

    if (!passedConfig || Object.keys(passedConfig).length === 0) {
      logger.warn("No config provided, using default config");
    }

    logger.info("Passed config: " + JSON.stringify(passedConfig, null, 2));

    this.config = {
      ...defaultConfig,
      ...(passedConfig || {}),
    };

    logger.info(
      "Starting the monitor using the effective config: " +
        JSON.stringify(this.config, null, 2)
    );

    if (this.config.decentralizedStorages?.ipfs?.enabled) {
      assert(
        this.config.decentralizedStorages.ipfs.gateways.length > 0,
        "IPFS gateways must be provided"
      );
      this.sourceFetchers.ipfs = new DecentralizedStorageFetcher(
        "ipfs",
        this.config.decentralizedStorages.ipfs.gateways
      );
    }

    const sourcifyChains = chainsToMonitor.map((chain) => {
      if (chain instanceof SourcifyChain) {
        return chain;
      } else {
        return new SourcifyChain({
          chainId: chain.chainId,
          rpc: authenticateRpcs(chain.rpc),
          name: chain.name,
          supported: true,
        });
      }
    });

    logger.info(
      `Starting ${
        sourcifyChains.length
      } chain monitors for chains: ${sourcifyChains
        .map((c) => c.chainId)
        .join(",")}`
    );

    if (sourcifyChains.length === 0) {
      throw new Error("No chains to monitor");
    }

    // Convert the chainId values to strings for comparison with object keys
    const chainIdSet = new Set(
      chainsToMonitor.map((item) => item.chainId.toString())
    );

    const chainsInConfigButNotChainsToMonitor: string[] = [];

    // Check if there's a chain config for a chain that's not being monitored
    for (const key in this.config.chainConfigs) {
      if (!chainIdSet.has(key)) {
        chainsInConfigButNotChainsToMonitor.push(key);
      }
    }

    if (chainsInConfigButNotChainsToMonitor.length > 0) {
      throw new Error(
        `Chain configs found for chains that are not being monitored: ${chainsInConfigButNotChainsToMonitor.join(
          ","
        )}`
      );
    }

    this.chainMonitors = sourcifyChains.map(
      (chain) => new ChainMonitor(chain, this.sourceFetchers, this.config)
    );
  }

  /**
   * Starts the monitor on all the designated chains.
   */
  start = async (): Promise<void> => {
    const promises: Promise<void>[] = [];
    for (const cm of this.chainMonitors) {
      promises.push(cm.start());
    }
    await Promise.all(promises);
    console.log("All started");
  };

  /**
   * Stops the monitor after executing all the pending requests.
   */
  stop = (): void => {
    this.chainMonitors.forEach((cm) => cm.stop());
  };
}

function authenticateRpcs(rpcs: string[]) {
  return rpcs.map((rpcUrl) => {
    if (rpcUrl.includes("{INFURA_API_KEY}") && process.env.INFURA_API_KEY) {
      return rpcUrl.replace("{INFURA_API_KEY}", process.env.INFURA_API_KEY);
    }
    if (rpcUrl.includes("{ALCHEMY_API_KEY}") && process.env.ALCHEMY_API_KEY) {
      return rpcUrl.replace("{ALCHEMY_API_KEY}", process.env.ALCHEMY_API_KEY);
    }
    if (rpcUrl.includes("ethpandaops.io")) {
      const ethersFetchReq = new FetchRequest(rpcUrl);
      ethersFetchReq.setHeader("Content-Type", "application/json");
      ethersFetchReq.setHeader(
        "CF-Access-Client-Id",
        process.env.CF_ACCESS_CLIENT_ID || ""
      );
      ethersFetchReq.setHeader(
        "CF-Access-Client-Secret",
        process.env.CF_ACCESS_CLIENT_SECRET || ""
      );
      return ethersFetchReq;
    }
    return rpcUrl;
  });
}
