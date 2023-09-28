import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";

export type KnownDecentralizedStorageFetchers = {
  [type in DecentralizedStorageOrigin]?: DecentralizedStorageFetcher;
};

export type DecentralizedStorageOrigin = "ipfs" | "bzzr1" | "bzzr0";

type DecentralizedStorageTypes = "ipfs" | "swarm";

type DecentralizedStorageConfig = {
  [K in DecentralizedStorageTypes]?: {
    enabled: boolean;
    gateways: string[];
    timeout?: number;
    interval?: number;
    retries?: number;
  };
};

export type ChainMonitorConfig = {
  startBlock?: number;
  blockInterval: number;
  blockIntervalFactor: number;
  blockIntervalUpperLimit: number;
  blockIntervalLowerLimit: number;
  bytecodeInterval: number;
  bytecodeNumberOfTries: number;
};

export type MonitorConfig = {
  decentralizedStorages: DecentralizedStorageConfig;
  sourcifyServerURLs: string[];
  defaultChainConfig: ChainMonitorConfig;
  chainConfigs?: {
    [chainId: number]: ChainMonitorConfig;
  };
};
