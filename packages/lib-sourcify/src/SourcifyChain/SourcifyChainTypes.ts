import SourcifyChain from './SourcifyChain';

export type SourcifyChainMap = {
  [chainId: string]: SourcifyChain;
};

export interface SourcifyChainsExtensionsObject {
  [chainId: string]: SourcifyChainExtension;
}

export type SourcifyChainExtension = {
  sourcifyName: string; // Keep it required to not forget name in sourcify-chains.json
  supported: boolean;
  etherscanApi?: {
    apiURL: string;
    apiKeyEnvName?: string;
  };
  fetchContractCreationTxUsing?: FetchContractCreationTxMethods;
  rpc?: Array<string | BaseRPC | APIKeyRPC | FetchRequestRPC>;
};

// types of the keys of FetchContractCreationTxMethods
export type FetchContractCreationTxMethod =
  keyof FetchContractCreationTxMethods;

export type TraceSupport = 'trace_transaction' | 'debug_traceTransaction';

export type BaseRPC = {
  url: string;
  type: 'BaseRPC';
  traceSupport?: TraceSupport;
};

// override the type of BaseRPC to add the type field
export type APIKeyRPC = Omit<BaseRPC, 'type'> & {
  type: 'APIKeyRPC';
  apiKeyEnvName: string;
  subDomainEnvName?: string;
};

// override the type of BaseRPC to add the type field
export type FetchRequestRPC = Omit<BaseRPC, 'type'> & {
  type: 'FetchRequest';
  headers?: Array<{
    headerName: string;
    headerEnvName: string;
  }>;
};

export type TraceSupportedRPC = {
  type: TraceSupport;
  index: number;
};

export interface FetchContractCreationTxMethods {
  blockscoutApi?: {
    url: string;
  };
  blockscoutScrape?: {
    url: string;
    blockscoutPrefix?: string;
  };
  routescanApi?: {
    type: 'mainnet' | 'testnet';
  };
  etherscanApi?: boolean;
  etherscanScrape?: {
    url: string;
  };
  blocksScanApi?: {
    url: string;
  };
  meterApi?: {
    url: string;
  };
  telosApi?: {
    url: string;
  };
  avalancheApi?: boolean;
  nexusApi?: {
    url: string;
    runtime: string;
  };
}

export type Chain = {
  name: string;
  title?: string;
  chainId: number;
  shortName?: string;
  network?: string;
  networkId?: number;
  nativeCurrency?: Currency;
  rpc: Array<string>;
  faucets?: string[];
  infoURL?: string;
};

type Currency = {
  name: string;
  symbol: string;
  decimals: number;
};

export interface ContractCreationFetcher {
  type: 'scrape' | 'api';
  url: string;
  responseParser?: Function;
  scrapeRegex?: string[];
}

// https://geth.ethereum.org/docs/developers/evm-tracing/built-in-tracers#call-tracer
export interface CallFrame {
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  error: string;
  revertReason: string;
  calls: CallFrame[];
}
