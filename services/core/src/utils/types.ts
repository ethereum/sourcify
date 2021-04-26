import { CheckedContract } from "./CheckedContract";
import Web3 from "web3";

export interface FileObject {
    name: string,
    path: string
    content?: string
  }

export interface ChainAddressPair {
  chain: string,
  address: string,
}

export interface InputData {
    chainAddressPairs: ChainAddressPair[],
    contract?: CheckedContract,
    bytecode?: string,
    creationData?: string,
}

export interface CompilationSettings {
  compilationTarget: any;
  outputSelection: any;
}

export interface Metadata {
  sources: any;
  settings: CompilationSettings;
  compiler: {
    version: string;
  };
}

export declare interface StringMap {
  [key: string]: string;
}

export interface PathBuffer {
  path?: string;
  buffer: Buffer;
}

export interface PathContent {
  path?: string;
  content: string;
}

export interface SourceMap {
  [compiledPath: string]: PathContent;
}

export interface Match {
  chain: string,
  address: string,
  status: Status,
  storageTimestamp?: Date,
  message?: string,
  encodedConstructorArgs?: string,
}

export type Status = 'perfect' | 'partial' | null;

export type CompareResult = {
  status: Status,
  encodedConstructorArgs: string
}

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
export type FilesInfo<T> = { status: MatchQuality, files: Array<T> };

export interface MonitorConfig {
  repository? : string,
  testing?: boolean
}

export declare interface StringToBooleanMap {
  [key: string]: boolean;
}

export type Tag = {
  timestamp: any,
  repositoryVersion: string
}

export declare interface ReformattedMetadata {
  input: any,
  fileName: string,
  contractName: string
}

type Currency = {
  name: string,
  symbol: string,
  decimals: number
};

export type Chain = {
  name: string,
  chainId: number,
  shortName: string,
  network: string,
  networkId: number,
  nativeCurrency: Currency,
  rpc: string[],
  faucets: string[],
  infoURL: string,
  fullnode?: { dappnode: string },
  contractFetchAddress?: string,
  txRegex?: string,
  archiveWeb3?: Web3,
};

export type InfoErrorLogger = {
  info: (obj: any, ...params: any[]) => void,
  error: (obj: any, ...params: any[]) => void
};