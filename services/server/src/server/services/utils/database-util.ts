import {
  ImmutableReferences,
  Libraries,
  Match,
  Metadata,
  Status,
  StorageLayout,
  Transformation,
  TransformationValues,
  CompiledContractCborAuxdata,
  AbstractCheckedContract,
} from "@ethereum-sourcify/lib-sourcify";
import { Abi } from "abitype";
import {
  Bytes,
  BytesSha,
  BytesKeccak,
  BytesTypes,
  Nullable,
} from "../../types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Tables {
  export interface Code {
    bytecode_hash: BytesSha;
    bytecode_hash_keccak: BytesKeccak;
    bytecode: Bytes;
  }
  export interface Contract {
    id: string;
    creation_bytecode_hash?: BytesSha;
    runtime_bytecode_hash: BytesSha;
  }
  export interface ContractDeployment {
    id: string;
    chain_id: string;
    address: Bytes;
    transaction_hash?: Bytes;
    contract_id: string;
    block_number?: number;
    txindex?: number;
    deployer?: Bytes;
  }

  export interface CompiledContract {
    id: string;
    compiler: string;
    version: string;
    language: string;
    name: string;
    fully_qualified_name: string;
    compilation_artifacts: {
      abi: Nullable<Abi>;
      userdoc: Nullable<any>;
      devdoc: Nullable<any>;
      storageLayout: Nullable<StorageLayout>;
      sources: Nullable<CompilationArtifactsSources>;
    };
    compiler_settings: Object;
    creation_code_hash?: BytesSha;
    runtime_code_hash: BytesSha;
    creation_code_artifacts: {
      sourceMap: Nullable<string>;
      linkReferences: Nullable<{}>;
      cborAuxdata: Nullable<CompiledContractCborAuxdata>;
    };
    runtime_code_artifacts: {
      sourceMap: Nullable<string>;
      linkReferences: Nullable<{}>;
      immutableReferences: Nullable<ImmutableReferences>;
      cborAuxdata: Nullable<CompiledContractCborAuxdata>;
    };
  }

  export interface VerifiedContract {
    id: number;
    compilation_id: string;
    deployment_id: string;
    creation_transformations: Nullable<Transformation[]>;
    creation_values: Nullable<TransformationValues>;
    runtime_transformations: Nullable<Transformation[]>;
    runtime_values: Nullable<TransformationValues>;
    runtime_match: boolean;
    creation_match: boolean;
    runtime_metadata_match: Nullable<boolean>;
    creation_metadata_match: Nullable<boolean>;
  }

  export interface Sources {
    source_hash: BytesSha;
    source_hash_keccak: BytesKeccak;
    content: string;
  }

  export interface CompiledContractsSources {
    id: string;
    compilation_id: string;
    source_hash: BytesSha;
    path: string;
  }

  export interface SourcifyMatch {
    verified_contract_id: number;
    runtime_match: Status | null;
    creation_match: Status | null;
    metadata: Metadata;
    created_at: Date;
  }

  export interface SourcifySync {
    chain_id: number;
    address: string;
    match_type: string;
  }
}

export interface CompilationArtifactsSources {
  [globalName: string]: {
    id: number;
  };
}

export interface SourceInformation {
  source_hash_keccak: BytesKeccak;
  content: string;
  path: string;
}

// This object contains all Tables fields except foreign keys generated during INSERTs
export interface DatabaseColumns {
  recompiledCreationCode?: Omit<Tables.Code, "bytecode_hash">;
  recompiledRuntimeCode: Omit<Tables.Code, "bytecode_hash">;
  onchainCreationCode?: Omit<Tables.Code, "bytecode_hash">;
  onchainRuntimeCode: Omit<Tables.Code, "bytecode_hash">;
  contractDeployment: Omit<Tables.ContractDeployment, "id" | "contract_id">;
  compiledContract: Omit<
    Tables.CompiledContract,
    "id" | "creation_code_hash" | "runtime_code_hash"
  >;
  verifiedContract: Omit<
    Tables.VerifiedContract,
    "id" | "compilation_id" | "deployment_id"
  >;
  sourcesInformation: SourceInformation[];
}

export type GetVerifiedContractByChainAndAddressResult =
  Tables.VerifiedContract & {
    transaction_hash: Bytes | null;
    contract_id: string;
  };

export type GetSourcifyMatchByChainAddressResult = Tables.SourcifyMatch &
  Pick<
    Tables.VerifiedContract,
    "creation_values" | "runtime_values" | "compilation_id"
  > &
  Pick<Tables.CompiledContract, "runtime_code_artifacts" | "name"> &
  Pick<Tables.ContractDeployment, "transaction_hash"> & {
    onchain_runtime_code: string;
  };

// Function overloads
export function bytesFromString<T extends BytesTypes>(str: string): T;
export function bytesFromString<T extends BytesTypes>(
  str: string | undefined,
): T | undefined;

export function bytesFromString<T extends BytesTypes>(
  str: string | undefined,
): T | undefined {
  if (str === undefined) {
    return undefined;
  }
  let stringWithout0x;
  if (str.substring(0, 2) === "0x") {
    stringWithout0x = str.substring(2);
  } else {
    stringWithout0x = str;
  }
  return Buffer.from(stringWithout0x, "hex") as T;
}

// Use the transformations array to normalize the library transformations in both runtime and creation recompiled bytecodes
// Normalization for recompiled bytecodes means:
//   Runtime bytecode:
//     1. Replace library address placeholders ("__$53aea86b7d70b31448b230b20ae141a537$__") with zeros
//     2. Immutables are already set to zeros
//   Creation bytecode:
//     1. Replace library address placeholders ("__$53aea86b7d70b31448b230b20ae141a537$__") with zeros
//     2. Immutables are already set to zeros
export function normalizeRecompiledBytecodes(
  recompiledContract: AbstractCheckedContract,
  match: Match,
) {
  recompiledContract.normalizedRuntimeBytecode =
    recompiledContract.runtimeBytecode;

  const PLACEHOLDER_LENGTH = 40;

  // Runtime bytecode normalzations
  match.runtimeTransformations?.forEach((transformation) => {
    if (
      transformation.reason === "library" &&
      recompiledContract.normalizedRuntimeBytecode
    ) {
      const placeholder = "0".repeat(PLACEHOLDER_LENGTH);
      const normalizedRuntimeBytecode =
        recompiledContract.normalizedRuntimeBytecode.substring(2);
      // we multiply by 2 because transformation.offset is stored as the length in bytes
      const before = normalizedRuntimeBytecode.substring(
        0,
        transformation.offset * 2,
      );
      const after = normalizedRuntimeBytecode.substring(
        transformation.offset * 2 + PLACEHOLDER_LENGTH,
      );
      recompiledContract.normalizedRuntimeBytecode = `0x${
        before + placeholder + after
      }`;
    }
  });

  // Creation bytecode normalizations
  if (recompiledContract.creationBytecode) {
    recompiledContract.normalizedCreationBytecode =
      recompiledContract.creationBytecode;
    match.creationTransformations?.forEach((transformation) => {
      if (
        transformation.reason === "library" &&
        recompiledContract.normalizedCreationBytecode
      ) {
        const placeholder = "0".repeat(PLACEHOLDER_LENGTH);
        const normalizedCreationBytecode =
          recompiledContract.normalizedCreationBytecode.substring(2);
        // we multiply by 2 because transformation.offset is stored as the length in bytes
        const before = normalizedCreationBytecode.substring(
          0,
          transformation.offset * 2,
        );
        const after = normalizedCreationBytecode.substring(
          transformation.offset * 2 + PLACEHOLDER_LENGTH,
        );
        recompiledContract.normalizedCreationBytecode = `0x${
          before + placeholder + after
        }`;
      }
    });
  }
}

export function prepareCompilerSettings(
  recompiledContract: AbstractCheckedContract,
) {
  // The metadata.settings contains recompiledContract that is not a field of compiler input
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { compilationTarget, ...restSettings } =
    recompiledContract.metadata.settings;

  const metadataLibraries =
    recompiledContract.metadata.settings?.libraries || {};
  restSettings.libraries = Object.keys(metadataLibraries || {}).reduce(
    (libraries, libraryKey) => {
      // Before Solidity v0.7.5: { "ERC20": "0x..."}
      if (!libraryKey.includes(":")) {
        if (!libraries[""]) {
          libraries[""] = {};
        }
        // try using the global method, available for pre 0.7.5 versions
        libraries[""][libraryKey] = metadataLibraries[libraryKey];
        return libraries;
      }

      // After Solidity v0.7.5: { "ERC20.sol:ERC20": "0x..."}
      const [contractPath, contractName] = libraryKey.split(":");
      if (!libraries[contractPath]) {
        libraries[contractPath] = {};
      }
      libraries[contractPath][contractName] = metadataLibraries[libraryKey];
      return libraries;
    },
    {} as Libraries,
  ) as any;

  return restSettings;
}
