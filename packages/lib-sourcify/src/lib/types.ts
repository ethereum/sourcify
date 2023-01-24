export interface PathBuffer {
  path: string;
  buffer: Buffer;
}

export interface PathContent {
  path: string;
  content: string;
}

export interface StringMap {
  [key: string]: string;
}

export interface InvalidSources {
  [key: string]: {
    expectedHash: string;
    calculatedHash: string;
    msg?: string; // Keep msg for compatibilty with legacy UI
  };
}

export interface MissingSources {
  [key: string]: {
    keccak256: string;
    urls: string[];
  };
}

// @TODO: Fully define metadata
export interface Metadata {
  compiler: {
    version: string;
  };
  language: string;
  output: any;
  settings: {
    compilationTarget: {
      [sourceName: string]: string;
    };
    evmVersion: string;
    libraries?: any;
    metadata: {
      bytecodeHash: 'none' | 'ipfs' | 'bzzr0' | 'bzzr1';
      useLiteralContent?: boolean;
    };
    optimizer?: {
      enabled: boolean;
      runs: number;
    };
    outputSelection: any;
  };
  sources: any;
}

// TODO: Fully define solcJsonInput
export declare interface CompilableMetadata {
  solcJsonInput: JsonInput;
  contractPath: string;
  contractName: string;
}

export interface RecompilationResult {
  creationBytecode: string;
  deployedBytecode: string;
  metadata: string;
}

export interface Match {
  address: string;
  chainId: string;
  status: Status;
  storageTimestamp?: Date;
  message?: string;
  abiEncodedConstructorArguments?: string;
  create2Args?: Create2Args;
  libraryMap?: StringMap;
  contextVariables?: ContextVariables;
}

export type Status =
  | 'perfect'
  | 'partial'
  | 'extra-file-input-bug'
  | 'error'
  | null;

export interface Create2Args {
  deployerAddress: string;
  salt: string;
  constructorArgs?: any[];
}

export type SourcifyChainExtension = {
  supported: boolean;
  monitored: boolean;
  contractFetchAddress?: string;
  graphQLFetchAddress?: string;
  txRegex?: string;
  rpc?: string[];
};

// TODO: Double check against ethereum-lists/chains type
export type Chain = {
  name: string;
  chainId: number;
  shortName: string;
  network?: string;
  networkId: number;
  nativeCurrency: Currency;
  rpc: string[];
  faucets?: string[];
  infoURL?: string;
};

// a type that extends the Chain type
export type SourcifyChain = Chain & SourcifyChainExtension;

export type SourcifyChainMap = {
  [chainId: string]: SourcifyChain;
};

type Currency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type ContextVariables = {
  abiEncodedConstructorArguments?: string;
  msgSender?: string;
};

interface File {
  keccak256?: string;
  urls?: string[];
  content?: string;
}

interface Sources {
  [key: string]: File;
}

interface YulDetails {
  stackAllocation: boolean;
  optimizerSteps?: string;
}

interface Details {
  peephole?: boolean;
  inliner?: boolean;
  jumpdestRemover?: boolean;
  orderLiterals?: boolean;
  deduplicate?: boolean;
  cse?: boolean;
  constantOptimizer?: boolean;
  yul?: boolean;
  yulDetails?: YulDetails;
}

interface Optimizer {
  enabled?: boolean;
  runs?: number;
  details?: Details;
}

enum DebugInfo {
  default = 'default',
  strip = 'strip',
  debug = 'debug',
  verboseDebug = 'verboseDebug',
}

interface Debug {
  revertStrings: DebugInfo;
  debugInfo?: string[];
}

interface SettingsMetadata {
  useLiteralContent?: boolean;
  bytecodeHash?: string;
}

interface MapContractAddress {
  [key: string]: string;
}

interface Libraries {
  [key: string]: MapContractAddress;
}

interface OutputSelection {
  [key: string]: any;
}

interface Contracts {
  [key: string]: string[];
}

interface ModelChecker {
  contracts?: Contracts;
  divModNoSlacks?: boolean;
  engine?: string;
  invariants?: string[];
  showUnproved?: boolean;
  solvers?: string[];
  targets?: string[];
  timeout?: number;
}

interface Settings {
  stopAfter?: string;
  remappings?: string[];
  optimizer?: Optimizer;
  evmVersion?: string;
  viaIR?: boolean;
  debug?: Debug;
  metadata?: SettingsMetadata;
  libraries?: Libraries;
  outputSelection: OutputSelection;
  modelChecker?: ModelChecker;
  compilationTarget?: string;
}

export interface JsonInput {
  language: string;
  sources: Sources;
  settings?: Settings;
}
