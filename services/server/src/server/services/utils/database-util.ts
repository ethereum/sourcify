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
  LinkReferences,
  VyperJsonInput,
  JsonInput,
  SolidityOutput,
  VyperOutput,
} from "@ethereum-sourcify/lib-sourcify";
import { Abi } from "abitype";
import {
  VerifiedContract as VerifiedContractApiObject,
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
    transaction_index?: number;
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
      linkReferences: Nullable<LinkReferences>;
      cborAuxdata: Nullable<CompiledContractCborAuxdata>;
    };
    runtime_code_artifacts: {
      sourceMap: Nullable<string>;
      linkReferences: Nullable<LinkReferences>;
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
    id: string;
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

export type GetSourcifyMatchesByChainResult = Pick<
  Tables.SourcifyMatch,
  "id" | "creation_match" | "runtime_match"
> & { address: string; verified_at: string };

export type GetSourcifyMatchByChainAddressWithPropertiesResult = Partial<
  Pick<
    Tables.SourcifyMatch,
    "id" | "creation_match" | "runtime_match" | "metadata"
  > &
    Pick<
      Tables.CompiledContract,
      | "language"
      | "compiler"
      | "version"
      | "compiler_settings"
      | "name"
      | "fully_qualified_name"
    > &
    Pick<
      Tables.CompiledContract["compilation_artifacts"],
      "abi" | "userdoc" | "devdoc"
    > &
    Pick<
      Tables.VerifiedContract,
      | "creation_transformations"
      | "creation_values"
      | "runtime_transformations"
      | "runtime_values"
    > &
    Pick<Tables.ContractDeployment, "block_number" | "transaction_index"> & {
      verified_at: string;
      address: string;
      onchain_creation_code: string;
      recompiled_creation_code: string;
      creation_source_map: Tables.CompiledContract["creation_code_artifacts"]["sourceMap"];
      creation_link_references: Tables.CompiledContract["creation_code_artifacts"]["linkReferences"];
      creation_cbor_auxdata: Tables.CompiledContract["creation_code_artifacts"]["cborAuxdata"];
      onchain_runtime_code: string;
      recompiled_runtime_code: string;
      runtime_source_map: Tables.CompiledContract["runtime_code_artifacts"]["sourceMap"];
      runtime_link_references: Tables.CompiledContract["runtime_code_artifacts"]["linkReferences"];
      runtime_cbor_auxdata: Tables.CompiledContract["runtime_code_artifacts"]["cborAuxdata"];
      runtime_immutable_references: Tables.CompiledContract["runtime_code_artifacts"]["immutableReferences"];
      transaction_hash: string;
      deployer: string;
      sources: { [path: string]: { content: string } };
      storage_layout: Tables.CompiledContract["compilation_artifacts"]["storageLayout"];
      std_json_input: JsonInput | VyperJsonInput;
      std_json_output: SolidityOutput | VyperOutput;
    }
>;

const sourcesAggregation =
  "json_object_agg(compiled_contracts_sources.path, json_build_object('content', sources.content))";

export const STORED_PROPERTIES_TO_SELECTORS = {
  id: "sourcify_matches.id",
  creation_match: "sourcify_matches.creation_match",
  runtime_match: "sourcify_matches.runtime_match",
  verified_at:
    'to_char(sourcify_matches.created_at, \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') as verified_at',
  address:
    "nullif(concat('0x', encode(contract_deployments.address, 'hex')), '0x') as address",
  onchain_creation_code:
    "nullif(concat('0x', encode(onchain_creation_code.code, 'hex')), '0x') as onchain_creation_code",
  recompiled_creation_code:
    "nullif(concat('0x', encode(recompiled_creation_code.code, 'hex')), '0x') as recompiled_creation_code",
  creation_source_map:
    "compiled_contracts.creation_code_artifacts->'sourceMap' as creation_source_map",
  creation_link_references:
    "compiled_contracts.creation_code_artifacts->'linkReferences' as creation_link_references",
  creation_cbor_auxdata:
    "compiled_contracts.creation_code_artifacts->'cborAuxdata' as creation_cbor_auxdata",
  creation_transformations: "verified_contracts.creation_transformations",
  creation_values: "verified_contracts.creation_values",
  onchain_runtime_code:
    "nullif(concat('0x', encode(onchain_runtime_code.code, 'hex')), '0x') as onchain_runtime_code",
  recompiled_runtime_code:
    "nullif(concat('0x', encode(recompiled_runtime_code.code, 'hex')), '0x') as recompiled_runtime_code",
  runtime_source_map:
    "compiled_contracts.runtime_code_artifacts->'sourceMap' as runtime_source_map",
  runtime_link_references:
    "compiled_contracts.runtime_code_artifacts->'linkReferences' as runtime_link_references",
  runtime_cbor_auxdata:
    "compiled_contracts.runtime_code_artifacts->'cborAuxdata' as runtime_cbor_auxdata",
  runtime_immutable_references:
    "compiled_contracts.runtime_code_artifacts->'immutableReferences' as runtime_immutable_references",
  runtime_transformations: "verified_contracts.runtime_transformations",
  runtime_values: "verified_contracts.runtime_values",
  transaction_hash:
    "nullif(concat('0x', encode(contract_deployments.transaction_hash, 'hex')), '0x') as transaction_hash",
  block_number: "contract_deployments.block_number",
  transaction_index: "contract_deployments.transaction_index",
  deployer:
    "nullif(concat('0x', encode(contract_deployments.deployer, 'hex')), '0x') as deployer",
  sources: `${sourcesAggregation} as sources`,
  language: "INITCAP(compiled_contracts.language) as language",
  compiler: "compiled_contracts.compiler",
  version: "compiled_contracts.version as version",
  compiler_settings: "compiled_contracts.compiler_settings",
  name: "compiled_contracts.name",
  fully_qualified_name: "compiled_contracts.fully_qualified_name",
  abi: "compiled_contracts.compilation_artifacts->'abi' as abi",
  metadata: "sourcify_matches.metadata",
  storage_layout:
    "compiled_contracts.compilation_artifacts->'storageLayout' as storage_layout",
  userdoc: "compiled_contracts.compilation_artifacts->'userdoc' as userdoc",
  devdoc: "compiled_contracts.compilation_artifacts->'devdoc' as devdoc",
  std_json_input: `json_build_object(
    'language', INITCAP(compiled_contracts.language), 
    'sources', ${sourcesAggregation},
    'settings', compiled_contracts.compiler_settings
  ) as std_json_input`,
  std_json_output: `json_build_object(
    'sources', compiled_contracts.compilation_artifacts->'sources',
    'contracts', json_build_object(
      substring(
        compiled_contracts.fully_qualified_name, 
        1, 
        length(compiled_contracts.fully_qualified_name) - length(split_part(compiled_contracts.fully_qualified_name, ':', -1)) - 1
      ), 
      json_build_object(
        split_part(compiled_contracts.fully_qualified_name, ':', -1), json_build_object(
          'abi', compiled_contracts.compilation_artifacts->'abi',
          'metadata', cast(sourcify_matches.metadata as text),
          'userdoc', compiled_contracts.compilation_artifacts->'userdoc',
          'devdoc', compiled_contracts.compilation_artifacts->'devdoc',
          'storageLayout', compiled_contracts.compilation_artifacts->'storageLayout',
          'evm', json_build_object(
            'bytecode', json_build_object(
              'object', nullif(concat('0x', encode(recompiled_creation_code.code, 'hex')), '0x'),
              'sourceMap', compiled_contracts.creation_code_artifacts->'sourceMap',
              'linkReferences', compiled_contracts.creation_code_artifacts->'linkReferences'
            ),
            'deployedBytecode', json_build_object(
              'object', nullif(concat('0x', encode(recompiled_runtime_code.code, 'hex')), '0x'),
              'sourceMap', compiled_contracts.runtime_code_artifacts->'sourceMap',
              'linkReferences', compiled_contracts.runtime_code_artifacts->'linkReferences',
              'immutableReferences', compiled_contracts.runtime_code_artifacts->'immutableReferences'
            )
          )
        )
      )
    )
  ) as std_json_output`,
};

export type StoredProperties = keyof typeof STORED_PROPERTIES_TO_SELECTORS;

type creationBytecodeSubfields = keyof NonNullable<
  VerifiedContractApiObject["creationBytecode"]
>;
type runtimeBytecodeSubfields = keyof NonNullable<
  VerifiedContractApiObject["runtimeBytecode"]
>;
type deploymentSubfields = keyof NonNullable<
  VerifiedContractApiObject["deployment"]
>;
type compilationSubfields = keyof NonNullable<
  VerifiedContractApiObject["compilation"]
>;
type proxyResolutionSubfields = keyof Partial<
  VerifiedContractApiObject["proxyResolution"]
>;

// used for API v2 GET contract endpoint
export const FIELDS_TO_STORED_PROPERTIES: Record<
  keyof Omit<
    VerifiedContractApiObject,
    | "chainId"
    | "address"
    | "match"
    | "creationBytecode"
    | "runtimeBytecode"
    | "deployment"
    | "compilation"
    | "proxyResolution"
  >,
  StoredProperties
> & {
  creationBytecode: Record<creationBytecodeSubfields, StoredProperties>;
  runtimeBytecode: Record<runtimeBytecodeSubfields, StoredProperties>;
  deployment: Record<deploymentSubfields, StoredProperties>;
  compilation: Record<compilationSubfields, StoredProperties>;
  proxyResolution: Record<proxyResolutionSubfields, StoredProperties>;
} = {
  matchId: "id",
  creationMatch: "creation_match",
  runtimeMatch: "runtime_match",
  verifiedAt: "verified_at",
  creationBytecode: {
    onchainBytecode: "onchain_creation_code",
    recompiledBytecode: "recompiled_creation_code",
    sourceMap: "creation_source_map",
    linkReferences: "creation_link_references",
    cborAuxdata: "creation_cbor_auxdata",
    transformations: "creation_transformations",
    transformationValues: "creation_values",
  },
  runtimeBytecode: {
    onchainBytecode: "onchain_runtime_code",
    recompiledBytecode: "recompiled_runtime_code",
    sourceMap: "runtime_source_map",
    linkReferences: "runtime_link_references",
    cborAuxdata: "runtime_cbor_auxdata",
    immutableReferences: "runtime_immutable_references",
    transformations: "runtime_transformations",
    transformationValues: "runtime_values",
  },
  deployment: {
    transactionHash: "transaction_hash",
    blockNumber: "block_number",
    transactionIndex: "transaction_index",
    deployer: "deployer",
  },
  sources: "sources",
  compilation: {
    language: "language",
    compiler: "compiler",
    compilerVersion: "version",
    compilerSettings: "compiler_settings",
    name: "name",
    fullyQualifiedName: "fully_qualified_name",
  },
  abi: "abi",
  metadata: "metadata",
  storageLayout: "storage_layout",
  userdoc: "userdoc",
  devdoc: "devdoc",
  stdJsonInput: "std_json_input",
  stdJsonOutput: "std_json_output",
  proxyResolution: {
    // TODO: remove onchainRuntimeBytecode and onchainCreationBytecode when proxy detection result is stored in database
    onchainRuntimeBytecode: "onchain_runtime_code",
    onchainCreationBytecode: "onchain_creation_code",
  },
};

export type Field =
  | keyof typeof FIELDS_TO_STORED_PROPERTIES
  | `creationBytecode.${creationBytecodeSubfields}`
  | `runtimeBytecode.${runtimeBytecodeSubfields}`
  | `deployment.${deploymentSubfields}`
  | `compilation.${compilationSubfields}`;

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
