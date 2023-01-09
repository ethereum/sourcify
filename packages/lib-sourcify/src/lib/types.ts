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
    compilationTarget: any;
    outputSelection: any;
    optimizer?: {
      enabled: boolean;
      runs: number;
    };
    libraries?: any;
  };
  sources: any;
}

// TODO: Fully define solcJsonInput
export declare interface CompilableMetadata {
  solcJsonInput: any;
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
  encodedConstructorArgs?: string;
  create2Args?: Create2Args;
  libraryMap?: StringMap;
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
