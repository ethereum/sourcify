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
export declare interface ReformattedMetadata {
  solcJsonInput: any;
  fileName: string;
  contractName: string;
}
