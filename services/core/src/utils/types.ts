import { CheckedContract } from "./CheckedContract";

export interface FileObject {
  name: string;
  path: string;
  content?: string;
}

export declare interface ContractData {
  full: string[];
  partial: string[];
}

export interface InjectorInput {
  chain: string;
  addresses: string[];
  contract: CheckedContract;
  bytecode?: string;
  creationData?: string;
}

export interface CompilationSettings {
  compilationTarget: any;
  outputSelection: any;
  optimizer?: {
    enabled: boolean;
    runs: number;
  };
}

export interface CompilerInfo {
  version: string;
}

export interface Metadata {
  sources: any;
  settings: CompilationSettings;
  compiler: CompilerInfo;
  output: any;
}

export declare interface StringMap {
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
export interface PathBuffer {
  path: string;
  buffer: Buffer;
}

export interface PathContent {
  path: string;
  content: string;
}

export interface SourceMap {
  [compiledPath: string]: PathContent;
}

export interface Create2Args {
  deployerAddress: string;
  salt: string;
  constructorArgs?: any[];
}

export interface Match {
  address: string;
  chainId: string;
  status: Status;
  storageTimestamp?: Date;
  message?: string;
  encodedConstructorArgs?: string;
  create2Args?: Create2Args;
  libraryMap?: StringMap;
}

export type Status =
  | "perfect"
  | "partial"
  | "extra-file-input-bug"
  | "error"
  | null;

/**
 * A type for specfifying the strictness level of querying (only full or any kind of matches)
 */
export type MatchLevel = "full_match" | "any_match";

/**
 * A type for specifying the match quality of files.
 */
export type MatchQuality = "full" | "partial";

/**
 * An array wrapper with info properties.
 */
export type FilesInfo<T> = { status: MatchQuality; files: Array<T> };

export interface MonitorConfig {
  repository?: string;
  testing?: boolean;
}

export declare interface StringToBooleanMap {
  [key: string]: boolean;
}

export type Tag = {
  timestamp: any;
  repositoryVersion: string;
};

export declare interface ReformattedMetadata {
  solcJsonInput: any;
  fileName: string;
  contractName: string;
}

type Currency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type Chain = {
  name: string;
  chainId: number;
  shortName: string;
  network: string;
  networkId: number;
  nativeCurrency: Currency;
  rpc: string[];
  faucets: string[];
  infoURL: string;
  contractFetchAddress?: string;
  graphQLFetchAddress?: string;
  txRegex?: string;
  // archiveWeb3?: Web3,
  supported?: boolean;
  monitored?: boolean;
};

export type InfoErrorLogger = {
  info: (obj: any, ...params: any[]) => void;
  error: (obj: any, ...params: any[]) => void;
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
  default = "default",
  strip = "strip",
  debug = "debug",
  verboseDebug = "verboseDebug",
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
}

export interface JsonInput {
  language: string;
  sources: Sources;
  settings?: Settings;
}

export interface Create2ConstructorArgument {
  type: string;
  value: any;
}
