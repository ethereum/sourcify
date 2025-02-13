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
  SolidityJsonInput,
  SolidityOutput,
  VyperOutput,
  Verification,
  SolidityOutputContract,
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
import { keccak256 } from "ethers";

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
      std_json_input: SolidityJsonInput | VyperJsonInput;
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
    "concat('0x',encode(contract_deployments.address, 'hex')) as address",
  onchain_creation_code:
    "concat('0x', encode(onchain_creation_code.code, 'hex')) as onchain_creation_code",
  recompiled_creation_code:
    "concat('0x', encode(recompiled_creation_code.code, 'hex')) as recompiled_creation_code",
  creation_source_map:
    "compiled_contracts.creation_code_artifacts->'sourceMap' as creation_source_map",
  creation_link_references:
    "compiled_contracts.creation_code_artifacts->'linkReferences' as creation_link_references",
  creation_cbor_auxdata:
    "compiled_contracts.creation_code_artifacts->'cborAuxdata' as creation_cbor_auxdata",
  creation_transformations: "verified_contracts.creation_transformations",
  creation_values: "verified_contracts.creation_values",
  onchain_runtime_code:
    "concat('0x', encode(onchain_runtime_code.code, 'hex')) as onchain_runtime_code",
  recompiled_runtime_code:
    "concat('0x', encode(recompiled_runtime_code.code, 'hex')) as recompiled_runtime_code",
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
    "concat('0x', encode(contract_deployments.transaction_hash, 'hex')) as transaction_hash",
  block_number: "contract_deployments.block_number",
  transaction_index: "contract_deployments.transaction_index",
  deployer:
    "concat('0x', encode(contract_deployments.deployer, 'hex')) as deployer",
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
              'object', concat('0x', encode(recompiled_creation_code.code, 'hex')),
              'sourceMap', compiled_contracts.creation_code_artifacts->'sourceMap',
              'linkReferences', compiled_contracts.creation_code_artifacts->'linkReferences'
            ),
            'deployedBytecode', json_build_object(
              'object', concat('0x', encode(recompiled_runtime_code.code, 'hex')),
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
    // TODO: remove onchainRuntimeBytecode, when proxy detection result is stored in database
    onchainRuntimeBytecode: "onchain_runtime_code",
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

export const withVerification = {
  // Use the transformations array to normalize the library transformations in both runtime and creation recompiled bytecodes
  // Normalization for recompiled bytecodes means:
  //   Runtime bytecode:
  //     1. Replace library address placeholders ("__$53aea86b7d70b31448b230b20ae141a537$__") with zeros
  //     2. Immutables are already set to zeros
  //   Creation bytecode:
  //     1. Replace library address placeholders ("__$53aea86b7d70b31448b230b20ae141a537$__") with zeros
  //     2. Immutables are already set to zeros
  normalizeRecompiledBytecodes(verification: Verification) {
    let normalizedRuntimeBytecode = verification.compilation.runtimeBytecode;
    let normalizedCreationBytecode = verification.compilation.creationBytecode;

    const PLACEHOLDER_LENGTH = 40;

    // Runtime bytecode normalzations
    verification.transformations.runtime.list.forEach((transformation) => {
      if (transformation.reason === "library" && normalizedRuntimeBytecode) {
        const placeholder = "0".repeat(PLACEHOLDER_LENGTH);
        normalizedRuntimeBytecode = normalizedRuntimeBytecode.substring(2);
        // we multiply by 2 because transformation.offset is stored as the length in bytes
        const before = normalizedRuntimeBytecode.substring(
          0,
          transformation.offset * 2,
        );
        const after = normalizedRuntimeBytecode.substring(
          transformation.offset * 2 + PLACEHOLDER_LENGTH,
        );
        normalizedRuntimeBytecode = `0x${before + placeholder + after}`;
      }
    });

    // Creation bytecode normalizations
    verification.transformations.creation.list.forEach((transformation) => {
      if (transformation.reason === "library" && normalizedCreationBytecode) {
        const placeholder = "0".repeat(PLACEHOLDER_LENGTH);
        normalizedCreationBytecode = normalizedCreationBytecode.substring(2);
        // we multiply by 2 because transformation.offset is stored as the length in bytes
        const before = normalizedCreationBytecode.substring(
          0,
          transformation.offset * 2,
        );
        const after = normalizedCreationBytecode.substring(
          transformation.offset * 2 + PLACEHOLDER_LENGTH,
        );
        normalizedCreationBytecode = `0x${before + placeholder + after}`;
      }
    });

    return {
      normalizedRuntimeBytecode,
      normalizedCreationBytecode,
    };
  },

  getKeccak256Bytecodes(
    verification: Verification,
    normalizedCreationBytecode: string,
    normalizedRuntimeBytecode: string,
  ) {
    if (verification.compilation.runtimeBytecode === undefined) {
      throw new Error("normalizedRuntimeBytecode cannot be undefined");
    }
    if (verification.onchainRuntimeBytecode === undefined) {
      throw new Error("onchainRuntimeBytecode cannot be undefined");
    }
    return {
      keccak256OnchainCreationBytecode: verification.onchainCreationBytecode
        ? keccak256(bytesFromString(verification.onchainCreationBytecode))
        : undefined,
      keccak256OnchainRuntimeBytecode: keccak256(
        bytesFromString(verification.onchainRuntimeBytecode),
      ),
      keccak256RecompiledCreationBytecode: normalizedCreationBytecode
        ? keccak256(
            bytesFromString(normalizedCreationBytecode), // eslint-disable-line indent
          ) // eslint-disable-line indent
        : undefined,
      keccak256RecompiledRuntimeBytecode: keccak256(
        bytesFromString(normalizedRuntimeBytecode),
      ),
    };
  },
  async getDatabaseColumnsFromVerification(
    verification: Verification,
    normalizedCreationBytecode: string,
    normalizedRuntimeBytecode: string,
  ): Promise<DatabaseColumns> {
    const {
      keccak256OnchainCreationBytecode,
      keccak256OnchainRuntimeBytecode,
      keccak256RecompiledCreationBytecode,
      keccak256RecompiledRuntimeBytecode,
    } = this.getKeccak256Bytecodes(
      verification,
      normalizedCreationBytecode,
      normalizedRuntimeBytecode,
    );

    const runtimeMatch =
      verification.status.runtimeMatch === "perfect" ||
      verification.status.runtimeMatch === "partial";
    const creationMatch =
      verification.status.creationMatch === "perfect" ||
      verification.status.creationMatch === "partial";

    const {
      runtime: {
        list: runtimeTransformations,
        values: runtimeTransformationValues,
      },
      creation: {
        list: creationTransformations,
        values: creationTransformationValues,
      },
    } = verification.transformations;

    // Force _transformations and _values to be null if not match
    // Force _transformations and _values to be not null if match
    let runtime_transformations = null;
    let runtime_values = null;
    let runtime_metadata_match = null;
    if (runtimeMatch) {
      runtime_transformations = runtimeTransformations
        ? runtimeTransformations
        : [];
      runtime_values = runtimeTransformationValues
        ? runtimeTransformationValues
        : {};
      runtime_metadata_match = verification.status.runtimeMatch === "perfect";
    }
    let creation_transformations = null;
    let creation_values = null;
    let creation_metadata_match = null;
    if (creationMatch) {
      creation_transformations = creationTransformations
        ? creationTransformations
        : [];
      creation_values = creationTransformationValues
        ? creationTransformationValues
        : {};
      creation_metadata_match = verification.status.creationMatch === "perfect";
    }

    const compilationTargetPath =
      verification.compilation.compilationTarget.path;
    const compilationTargetName =
      verification.compilation.compilationTarget.name;
    const compilerOutput = verification.compilation.compilationTargetContract;

    // If during verification `generateCborAuxdataPositions` was not called, we call it now
    if (
      verification.compilation.runtimeBytecodeCborAuxdata === undefined &&
      verification.compilation.creationBytecodeCborAuxdata === undefined
    ) {
      if (!(await verification.compilation.generateCborAuxdataPositions())) {
        throw new Error(
          `cannot generate contract artifacts address=${verification.address} chainId=${verification.chainId}`,
        );
      }
    }

    // Prepare compilation_artifacts.sources by removing everything except id
    let sources: Nullable<CompilationArtifactsSources> = null;
    if (verification.compilation.compilerOutput?.sources) {
      sources = {};
      for (const source of Object.keys(
        verification.compilation.compilerOutput.sources,
      )) {
        sources[source] = {
          id: verification.compilation.compilerOutput.sources[source].id,
        };
      }
    }

    // For some property we cast compilerOutput as SolidityOutputContract because VyperOutput does not have them
    const compilationArtifacts = {
      abi: compilerOutput?.abi || null,
      userdoc: compilerOutput?.userdoc || null,
      devdoc: compilerOutput?.devdoc || null,
      storageLayout:
        (compilerOutput as SolidityOutputContract)?.storageLayout || null,
      sources,
    };
    const creationCodeArtifacts = {
      sourceMap:
        (compilerOutput as SolidityOutputContract)?.evm?.bytecode?.sourceMap ||
        null,
      linkReferences:
        (compilerOutput as SolidityOutputContract)?.evm?.bytecode
          ?.linkReferences || null,
      cborAuxdata: verification.compilation.creationBytecodeCborAuxdata || null,
    };
    const runtimeCodeArtifacts = {
      sourceMap: compilerOutput?.evm.deployedBytecode?.sourceMap || null,
      linkReferences:
        (compilerOutput as SolidityOutputContract)?.evm?.deployedBytecode
          ?.linkReferences || null,
      immutableReferences:
        (compilerOutput as SolidityOutputContract)?.evm?.deployedBytecode
          ?.immutableReferences || null,
      cborAuxdata: verification.compilation.runtimeBytecodeCborAuxdata || null,
    };

    // runtime bytecodes must exist
    if (normalizedRuntimeBytecode === undefined) {
      throw new Error("Missing normalized runtime bytecode");
    }
    if (verification.onchainRuntimeBytecode === undefined) {
      throw new Error("Missing onchain runtime bytecode");
    }

    let recompiledCreationCode: Omit<Tables.Code, "bytecode_hash"> | undefined;
    if (normalizedCreationBytecode && keccak256RecompiledCreationBytecode) {
      recompiledCreationCode = {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256RecompiledCreationBytecode,
        ),
        bytecode: bytesFromString<Bytes>(normalizedCreationBytecode),
      };
    }

    let onchainCreationCode: Omit<Tables.Code, "bytecode_hash"> | undefined;

    if (
      verification.onchainCreationBytecode &&
      keccak256OnchainCreationBytecode
    ) {
      onchainCreationCode = {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256OnchainCreationBytecode,
        ),
        bytecode: bytesFromString<Bytes>(verification.onchainCreationBytecode),
      };
    }

    const sourcesInformation = Object.keys(
      verification.compilation.jsonInput.sources,
    ).map((path) => {
      return {
        path,
        source_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256(
            Buffer.from(
              verification.compilation.jsonInput.sources[path].content,
            ),
          ),
        ),
        content: verification.compilation.jsonInput.sources[path].content,
      };
    });

    return {
      recompiledCreationCode,
      recompiledRuntimeCode: {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256RecompiledRuntimeBytecode,
        ),
        bytecode: bytesFromString<Bytes>(normalizedRuntimeBytecode),
      },
      onchainCreationCode,
      onchainRuntimeCode: {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256OnchainRuntimeBytecode,
        ),
        bytecode: bytesFromString<Bytes>(verification.onchainRuntimeBytecode),
      },
      contractDeployment: {
        chain_id: verification.chainId.toString(),
        address: bytesFromString(verification.address),
        transaction_hash: bytesFromString(verification.deploymentInfo.txHash),
        block_number: verification.deploymentInfo.blockNumber,
        transaction_index: verification.deploymentInfo.txIndex,
        deployer: bytesFromString(verification.deploymentInfo.deployer),
      },
      compiledContract: {
        language: verification.compilation.language.toLocaleLowerCase(),
        compiler:
          verification.compilation.language.toLocaleLowerCase() === "solidity"
            ? "solc"
            : "vyper",
        compiler_settings: verification.compilation.jsonInput.settings,
        name: verification.compilation.compilationTarget.name,
        version: verification.compilation.compilerVersion,
        fully_qualified_name: `${compilationTargetPath}:${compilationTargetName}`,
        compilation_artifacts: compilationArtifacts,
        creation_code_artifacts: creationCodeArtifacts,
        runtime_code_artifacts: runtimeCodeArtifacts,
      },
      sourcesInformation,
      verifiedContract: {
        runtime_transformations,
        creation_transformations,
        runtime_values,
        creation_values,
        runtime_match: runtimeMatch,
        creation_match: creationMatch,
        // We cover also no-metadata case by using match === "perfect"
        runtime_metadata_match,
        creation_metadata_match,
      },
    };
  },
};

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
