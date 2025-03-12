import { Abi } from 'abitype';
import {
  CompilationLanguage,
  CompilationTarget,
  CompiledContractCborAuxdata,
  Devdoc,
  LinkReferences,
  Metadata,
  StringMap,
  Userdoc,
} from '../Compilation/CompilationTypes';
import {
  ImmutableReferences,
  SoliditySettings,
  StorageLayout,
} from '../Compilation/SolidityTypes';
import { VyperSettings } from '../Compilation/VyperTypes';
import { SourcifyLibError } from '../SourcifyLibError';
import { Transformation, TransformationValues } from './Transformations';

export interface BytecodeMatchingResult {
  match: 'perfect' | 'partial' | null;
  libraryMap?: StringMap;
  populatedRecompiledBytecode: string;
  transformations: Transformation[];
  transformationValues: TransformationValues;
  message?: string;
}

export type VerificationErrorCode =
  | 'cant_fetch_bytecode'
  | 'contract_not_deployed'
  | 'compiled_bytecode_is_zero'
  | 'extra_file_input_bug'
  | 'creation_bytecode_match_error'
  | 'no_match'
  | 'onchain_runtime_bytecode_not_available'
  | 'onchain_creation_bytecode_not_available'
  | 'bytecode_length_mismatch';

export class VerificationError extends SourcifyLibError {
  constructor(message: string, code: VerificationErrorCode) {
    super(message, code);
  }
}

export enum SolidityBugType {
  NONE,
  IR_OUTPUT_ORDERING_BUG,
  EXTRA_FILE_INPUT_BUG,
}

export type VerificationStatus =
  | 'perfect'
  | 'partial'
  | 'extra-file-input-bug'
  | 'error'
  | null;

export interface VerificationExport {
  address: string;
  chainId: number;
  status: {
    runtimeMatch: VerificationStatus;
    creationMatch: VerificationStatus;
  };
  onchainRuntimeBytecode?: string;
  onchainCreationBytecode?: string;
  transformations: {
    runtime: {
      list: Transformation[];
      values: TransformationValues;
    };
    creation: {
      list: Transformation[];
      values: TransformationValues;
    };
  };
  deploymentInfo: {
    blockNumber?: number;
    txIndex?: number;
    deployer?: string;
    txHash?: string;
  };
  libraryMap: {
    runtime?: StringMap;
    creation?: StringMap;
  };
  compilation: {
    language: CompilationLanguage;
    compilationTarget: CompilationTarget;
    compilerOutput: {
      // The export should not include the AST object to reduce the size
      sources?: Record<string, { id: number }>;
    };
    contractCompilerOutput: {
      abi?: Abi;
      userdoc?: Userdoc;
      devdoc?: Devdoc;
      storageLayout?: StorageLayout;
      evm: {
        bytecode: {
          sourceMap?: string;
          linkReferences?: LinkReferences;
        };
        deployedBytecode: {
          sourceMap?: string;
          linkReferences?: LinkReferences;
          immutableReferences?: ImmutableReferences;
        };
      };
    };
    runtimeBytecode?: string;
    creationBytecode?: string;
    runtimeBytecodeCborAuxdata?: CompiledContractCborAuxdata;
    creationBytecodeCborAuxdata?: CompiledContractCborAuxdata;
    metadata?: Metadata;
    jsonInput: {
      settings: SoliditySettings | VyperSettings;
    };
  };
}
