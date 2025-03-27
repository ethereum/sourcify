export interface PathBuffer {
  path: string;
  buffer: Buffer;
}

export interface PathContent {
  path: string;
  content: string;
}

export interface MissingSources {
  [key: string]: {
    keccak256: string;
    urls: string[];
  };
}

export interface InvalidSources {
  [key: string]: {
    expectedHash: string;
    calculatedHash: string;
    msg?: string; // Keep msg for compatibilty with legacy UI
  };
}

export interface IpfsGateway {
  url: string;
  headers?: HeadersInit;
}

export interface VariedPathContent extends PathContent {
  variation: string;
}
