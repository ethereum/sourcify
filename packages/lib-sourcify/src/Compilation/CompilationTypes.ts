import {
  SolidityJsonInput,
  SolidityOutput,
  VyperJsonInput,
  VyperOutput,
} from '@ethereum-sourcify/compilers-types';
import { SourcifyLibError } from '../SourcifyLibError';

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

export type CompilationLanguage = 'Solidity' | 'Vyper';

export type CompilationErrorCode =
  | 'cannot_generate_cbor_auxdata_positions'
  | 'invalid_compiler_version'
  | 'contract_not_found_in_compiler_output'
  | 'compiler_error'
  | 'no_compiler_output'
  | 'metadata_not_set'
  | 'creation_bytecode_cbor_auxdata_not_set'
  | 'runtime_bytecode_cbor_auxdata_not_set';

export class CompilationError extends SourcifyLibError {
  constructor(code: CompilationErrorCode) {
    super(code);
  }
}

export interface ISolidityCompiler {
  compile(
    version: string,
    solcJsonInput: SolidityJsonInput,
    forceEmscripten?: boolean,
  ): Promise<SolidityOutput>;
}

export interface IVyperCompiler {
  compile(
    version: string,
    vyperJsonInput: VyperJsonInput,
  ): Promise<VyperOutput>;
}
