import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";
import assert from "assert";
import { EventEmitter } from "stream";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import logger from "./logger";
import { ChainMonitor } from "./ChainMonitor";
import { KnownDecentralizedStorageFetchers } from "./types";

type DecentralizedStorageTypes = "ipfs" | "swarm";

type DecentralizedStorageConfig = {
  [K in DecentralizedStorageTypes]?: {
    enabled: boolean;
    gateways: string[];
    gatewayTimeout?: number;
  };
};

export default class Monitor extends EventEmitter {
  private chainMonitors: ChainMonitor[];
  private sourceFetchers: KnownDecentralizedStorageFetchers = {};
  private sourcifyServerURLs: string[];

  constructor(
    chainsToMonitor: SourcifyChain[],
    decentralizedStorageConfig: DecentralizedStorageConfig = {
      ipfs: {
        enabled: true,
        gateways: ["https://ipfs.io/ipfs/"],
      },
    },
    sourcifyServerURLs: string[] = ["https://sourcify.dev/server/"]
  ) {
    super();
    this.sourcifyServerURLs = sourcifyServerURLs;
    if (decentralizedStorageConfig?.ipfs?.enabled) {
      assert(
        decentralizedStorageConfig.ipfs.gateways.length > 0,
        "IPFS gateways must be provided"
      );
      this.sourceFetchers.ipfs = new DecentralizedStorageFetcher(
        "ipfs",
        decentralizedStorageConfig.ipfs.gateways
      );
    }

    // TODO: add support for swarm

    chainsToMonitor = chainsToMonitor.filter((c) => c.monitored && c.supported);

    logger.info(
      `Starting ${
        chainsToMonitor.length
      } chain monitors for chains: ${chainsToMonitor
        .map((c) => c.chainId)
        .join(",")}`
    );

    this.chainMonitors = chainsToMonitor.map(
      (chain) =>
        new ChainMonitor(chain, this.sourceFetchers, this.sourcifyServerURLs)
    );
  }

  /**
   * Starts the monitor on all the designated chains.
   */
  start = async (): Promise<void> => {
    const promises = [];
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
