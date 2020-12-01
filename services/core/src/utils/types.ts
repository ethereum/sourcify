import Web3 from "web3";
import { CheckedContract } from "./CheckedContract";

export interface FileObject {
    name: string,
    path: string
    content?: string
  }

export interface InputData {
    chain: string,
    addresses: string[],
    contracts?: CheckedContract[],
    bytecode?: string;
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
  address: string | null,
  status: 'perfect' | 'partial' | null
}

export interface MonitorConfig {
  ipfsCatRequest? : string,
  ipfsProvider? : any,
  swarmGateway? : string,
  repository? : string,
  blockTime? : number,
  silent?: boolean
}

export interface CustomChainConfig {
  name: string,
  url: string
}

export declare interface ChainSet {
  [key: string]: ChainData
}

export declare interface ChainData {
  web3 : Web3,
  metadataQueue: Queue,
  sourceQueue: Queue,
  latestBlock : number,
  chainId: string
}

export declare interface Queue {
  [key: string]: QueueItem;
}

export declare interface QueueItem {
  bzzr1? : string,
  ipfs? : string,
  timestamp? : number,
  metadataRaw? : string,
  sources?: any,
  found?: any,
  bytecode?: string
}

export declare interface StringToBooleanMap {
  [key: string]: boolean;
}

export type Tag = {
  timestamp: any,
  repositoryVersion: string
}