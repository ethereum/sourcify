import { CompilerOutput } from './types';

export interface VyperSettings {
  /** EVM version to compile for. Can be london, paris, shanghai or cancun (default) */
  evmVersion: 'london' | 'paris' | 'shanghai' | 'cancun' | 'istanbul';
  /** Optimization mode. Defaults to "gas". */
  optimize?: 'gas' | 'codesize' | 'none' | boolean;
  /** Whether the bytecode should include Vyper's signature. Defaults to true */
  bytecodeMetadata?: boolean;
  /** Whether to use the experimental venom pipeline. Defaults to false */
  experimentalCodegen?: boolean;
  /** The search paths to use for resolving imports */
  search_paths?: string[];
  outputSelection: {
    [key: string]: string[] | { [contractName: string]: string[] };
  };
}

export interface VyperJsonInput {
  language: 'Vyper';
  sources: {
    [sourcePath: string]: {
      keccak256?: string;
      content: string;
    };
  };
  /**
   * Optional: Sources made available for import by the compiled contracts.
   * For .vy suffix, compiler expects Vyper syntax.
   * For .json suffix, compiler expects an ABI object.
   */
  interfaces?: {
    [interfacePath: string]: {
      content?: string;
      abi?: any[];
    };
  };
  settings?: VyperSettings;
}

export interface IVyperCompiler {
  compile(
    version: string,
    solcJsonInput: VyperJsonInput,
    forceEmscripten?: boolean,
  ): Promise<CompilerOutput>;
}
