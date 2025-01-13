import { Abi } from 'abitype';
import { ImmutableReferences } from './SolidityTypes';

export interface LinkReferences {
  [filePath: string]: {
    [libraryName: string]: [
      {
        length: number;
        start: number;
      },
    ];
  };
}

export interface MetadataSource {
  keccak256: string;
  content?: string;
  urls?: string[];
  license?: string;
}

export interface MetadataSourceMap {
  [index: string]: MetadataSource;
}

export interface Devdoc {
  author?: string;
  details?: string;
  errors?: {
    [index: string]: {
      details?: string;
    };
  };
  events?: {
    [index: string]: {
      details?: string;
      params?: any;
    };
  };
  kind: 'dev';
  methods: {
    [index: string]: {
      details?: string;
      params?: any;
      returns?: any;
    };
  };
  stateVariables?: any;
  title?: string;
  version?: number;
}

export interface Userdoc {
  errors?: {
    [index: string]: {
      notice?: string;
    }[];
  };
  events?: {
    [index: string]: {
      notice?: string;
    };
  };
  kind: 'user';
  methods: {
    [index: string]: {
      notice: string;
    };
  };
  version?: number;
}

export interface MetadataOutput {
  abi: Abi;
  devdoc: Devdoc;
  userdoc: Userdoc;
}

// Metadata type that reflects the metadata object from
// https://docs.soliditylang.org/en/latest/metadata.html
export interface Metadata {
  compiler: {
    keccak256?: string;
    version: string;
  };
  language: string;
  output: MetadataOutput;
  settings: {
    compilationTarget: {
      [sourceName: string]: string;
    };
    evmVersion?: string;
    libraries?: {
      [index: string]: string;
    };
    metadata?: {
      appendCBOR?: boolean;
      bytecodeHash?: 'none' | 'ipfs' | 'bzzr0' | 'bzzr1';
      useLiteralContent?: boolean;
    };
    optimizer?: {
      details?: {
        constantOptimizer?: boolean;
        cse?: boolean;
        deduplicate?: boolean;
        inliner?: boolean;
        jumpdestRemover?: boolean;
        orderLiterals?: boolean;
        peephole?: boolean;
        yul?: boolean;
        yulDetails?: {
          optimizerSteps?: string;
          stackAllocation?: boolean;
        };
      };
      enabled: boolean;
      runs: number;
    };
    viaIR?: boolean;
    outputSelection?: any;
  };
  sources: MetadataSourceMap;
  version: number;
}

export interface CompiledContractCborAuxdata {
  [index: string]: {
    offset: number;
    value: string;
  };
}

export interface StringMap {
  [key: string]: string;
}

export interface AuxdataDiff {
  real: string;
  diffStart: number;
  diff: string;
}

export interface CompilationTarget {
  name: string;
  path: string;
}
