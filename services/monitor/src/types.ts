import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";

export type KnownDecentralizedStorageFetchers = {
  [type in DecentralizedStorageOrigin]?: DecentralizedStorageFetcher;
};

export type DecentralizedStorageOrigin = "ipfs" | "bzzr1" | "bzzr0";

type DecentralizedStorageTypes = "ipfs" | "swarm";

export type GatewayFetcherConfig = {
  url: string;
  timeout: number;
  interval: number;
  retries: number;
  headers?: HeadersInit;
};

export type DecentralizedStorageConfig = Partial<GatewayFetcherConfig> & {
  enabled: boolean;
  gateways: Array<string | Partial<GatewayFetcherConfig>>;
};

export type DecentralizedStorageConfigMap = {
  [K in DecentralizedStorageTypes]?: DecentralizedStorageConfig;
};

export type ChainMonitorConfig = {
  startBlock?: number;
  blockInterval?: number;
  blockIntervalFactor?: number;
  blockIntervalUpperLimit?: number;
  blockIntervalLowerLimit?: number;
  bytecodeInterval?: number;
  bytecodeNumberOfTries?: number;
};

export type DefatultChainMonitorConfig = {
  startBlock: undefined; // Default to latest block
  blockInterval: number;
  blockIntervalFactor: number;
  blockIntervalUpperLimit: number;
  blockIntervalLowerLimit: number;
  bytecodeInterval: number;
  bytecodeNumberOfTries: number;
};

export type MonitorConfig = {
  decentralizedStorages: DecentralizedStorageConfigMap;
  sourcifyServerURLs: string[];
  defaultChainConfig: DefatultChainMonitorConfig;
  chainConfigs?: {
    [chainId: number]: ChainMonitorConfig;
  };
};

export type PassedMonitorConfig = {
  decentralizedStorages?: DecentralizedStorageConfig;
  sourcifyServerURLs?: string[];
  defaultChainConfig?: DefatultChainMonitorConfig;
  chainConfigs?: {
    [chainId: number]: ChainMonitorConfig;
  };
};
