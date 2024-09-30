import {
  CheckedContract,
  ImmutableReferences,
  Libraries,
  Match,
  Metadata,
  Status,
  StorageLayout,
  Transformation,
  TransformationValues,
  CompiledContractCborAuxdata,
} from "@ethereum-sourcify/lib-sourcify";
import { Pool, PoolClient, QueryResult } from "pg";
import { Abi } from "abitype";
import {
  Bytes,
  BytesSha,
  BytesKeccak,
  BytesTypes,
  Nullable,
} from "../../types";
import logger from "../../../common/logger";
import { createHash } from "crypto";

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

export async function getVerifiedContractByChainAndAddress(
  pool: Pool,
  schema: string,
  chain: number,
  address: Bytes,
): Promise<QueryResult<GetVerifiedContractByChainAndAddressResult>> {
  return await pool.query(
    `
      SELECT
        verified_contracts.*,
        contract_deployments.transaction_hash,
        contract_deployments.contract_id
      FROM ${schema}.verified_contracts
      JOIN ${schema}.contract_deployments ON contract_deployments.id = verified_contracts.deployment_id
      WHERE 1=1
        AND contract_deployments.chain_id = $1
        AND contract_deployments.address = $2
    `,
    [chain, address],
  );
}

export type GetSourcifyMatchByChainAddressResult = Tables.SourcifyMatch &
  Pick<
    Tables.VerifiedContract,
    "creation_values" | "runtime_values" | "compilation_id"
  > &
  Pick<Tables.CompiledContract, "runtime_code_artifacts"> &
  Pick<Tables.ContractDeployment, "transaction_hash">;

export async function getSourcifyMatchByChainAddress(
  pool: Pool,
  schema: string,
  chain: number,
  address: Bytes,
  onlyPerfectMatches: boolean = false,
): Promise<QueryResult<GetSourcifyMatchByChainAddressResult>> {
  return await pool.query(
    `
      SELECT
        sourcify_matches.created_at,
        sourcify_matches.creation_match,
        sourcify_matches.runtime_match,
        sourcify_matches.metadata,
        verified_contracts.creation_values,
        verified_contracts.runtime_values,
        verified_contracts.compilation_id,
        compiled_contracts.runtime_code_artifacts,
        contract_deployments.transaction_hash
      FROM ${schema}.sourcify_matches
      JOIN ${schema}.verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
      JOIN ${schema}.compiled_contracts ON compiled_contracts.id = verified_contracts.compilation_id
      JOIN ${schema}.contract_deployments ON 
        contract_deployments.id = verified_contracts.deployment_id 
        AND contract_deployments.chain_id = $1 
        AND contract_deployments.address = $2
${
  onlyPerfectMatches
    ? "WHERE sourcify_matches.creation_match = 'perfect' OR sourcify_matches.runtime_match = 'perfect'"
    : ""
}
    `,
    [chain, address],
  );
}

export async function getCompiledContractSources(
  pool: Pool,
  compilation_id: string,
): Promise<
  QueryResult<Tables.CompiledContractsSources & Pick<Tables.Sources, "content">>
> {
  return await pool.query(
    `
      SELECT
        compiled_contracts_sources.*,
        sources.content
      FROM compiled_contracts_sources
      LEFT JOIN sources ON sources.source_hash = compiled_contracts_sources.source_hash
      WHERE compilation_id = $1
    `,
    [compilation_id],
  );
}

export async function insertCode(
  pool: PoolClient,
  schema: string,
  { bytecode_hash_keccak, bytecode }: Omit<Tables.Code, "bytecode_hash">,
): Promise<QueryResult<Pick<Tables.Code, "bytecode_hash">>> {
  let codeInsertResult = await pool.query(
    `INSERT INTO ${schema}.code (code_hash, code, code_hash_keccak) VALUES (digest($1::bytea, 'sha256'), $1::bytea, $2) ON CONFLICT (code_hash) DO NOTHING RETURNING code_hash as bytecode_hash`,
    [bytecode, bytecode_hash_keccak],
  );

  // If there is a conflict (ie. code already exists), the response will be empty. We still need to return the object to fill other tables
  if (codeInsertResult.rows.length === 0) {
    codeInsertResult = await pool.query(
      `SELECT
        code_hash as bytecode_hash
      FROM ${schema}.code
      WHERE code_hash = digest($1::bytea, 'sha256')`,
      [bytecode],
    );
  }
  return codeInsertResult;
}

export async function insertContract(
  pool: PoolClient,
  schema: string,
  {
    creation_bytecode_hash,
    runtime_bytecode_hash,
  }: Omit<Tables.Contract, "id">,
): Promise<QueryResult<Pick<Tables.Contract, "id">>> {
  let contractInsertResult = await pool.query(
    `INSERT INTO ${schema}.contracts (creation_code_hash, runtime_code_hash) VALUES ($1, $2) ON CONFLICT (creation_code_hash, runtime_code_hash) DO NOTHING RETURNING *`,
    [creation_bytecode_hash, runtime_bytecode_hash],
  );

  if (contractInsertResult.rows.length === 0) {
    contractInsertResult = await pool.query(
      `
      SELECT
        id
      FROM ${schema}.contracts
      WHERE creation_code_hash = $1 AND runtime_code_hash = $2
      `,
      [creation_bytecode_hash, runtime_bytecode_hash],
    );
  }
  return contractInsertResult;
}

export async function insertContractDeployment(
  pool: PoolClient,
  schema: string,
  {
    chain_id,
    address,
    transaction_hash,
    contract_id,
    block_number,
    txindex,
    deployer,
  }: Omit<Tables.ContractDeployment, "id">,
): Promise<QueryResult<Pick<Tables.ContractDeployment, "id">>> {
  let contractDeploymentInsertResult = await pool.query(
    `INSERT INTO 
      ${schema}.contract_deployments (
        chain_id,
        address,
        transaction_hash,
        contract_id,
        block_number,
        transaction_index,
        deployer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (chain_id, address, transaction_hash) DO NOTHING RETURNING *`,
    [
      chain_id,
      address,
      transaction_hash,
      contract_id,
      block_number,
      txindex,
      deployer,
    ],
  );

  if (contractDeploymentInsertResult.rows.length === 0) {
    contractDeploymentInsertResult = await pool.query(
      `
      SELECT
        id
      FROM ${schema}.contract_deployments
      WHERE 1=1 
        AND chain_id = $1
        AND address = $2
        AND transaction_hash = $3
      `,
      [chain_id, address, transaction_hash],
    );
  }
  return contractDeploymentInsertResult;
}

export async function insertCompiledContract(
  pool: PoolClient,
  schema: string,
  {
    compiler,
    version,
    language,
    name,
    fully_qualified_name,
    compilation_artifacts,
    compiler_settings,
    creation_code_hash,
    runtime_code_hash,
    creation_code_artifacts,
    runtime_code_artifacts,
  }: Omit<Tables.CompiledContract, "id">,
): Promise<QueryResult<Pick<Tables.CompiledContract, "id">>> {
  let compiledContractsInsertResult = await pool.query(
    `
      INSERT INTO ${schema}.compiled_contracts (
        compiler,
        version,
        language,
        name,
        fully_qualified_name,
        compilation_artifacts,
        compiler_settings,
        creation_code_hash,
        runtime_code_hash,
        creation_code_artifacts,
        runtime_code_artifacts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (compiler, language, creation_code_hash, runtime_code_hash) DO NOTHING RETURNING *
    `,
    [
      compiler,
      version,
      language,
      name,
      fully_qualified_name,
      compilation_artifacts,
      compiler_settings,
      creation_code_hash,
      runtime_code_hash,
      creation_code_artifacts,
      runtime_code_artifacts,
    ],
  );

  if (compiledContractsInsertResult.rows.length === 0) {
    compiledContractsInsertResult = await pool.query(
      `
        SELECT
          id
        FROM ${schema}.compiled_contracts
        WHERE 1=1
          AND compiler = $1
          AND language = $2
          AND (creation_code_hash = $3 OR (creation_code_hash IS NULL AND $3 IS NULL))
          AND runtime_code_hash = $4
        `,
      [compiler, language, creation_code_hash, runtime_code_hash],
    );
  }
  return compiledContractsInsertResult;
}

export async function insertCompiledContractsSources(
  pool: PoolClient,
  {
    sourcesInformation,
    compilation_id,
  }: {
    sourcesInformation: SourceInformation[];
    compilation_id: string;
  },
) {
  const sourceCodesQueryIndexes: string[] = [];
  const sourceCodesQueryValues: any[] = [];

  // Loop through each `sourceInformation` to generate the `INSERT INTO sources` query placeholders and values
  sourcesInformation.forEach((sourceCode, sourceCodesQueryIndex) => {
    sourceCodesQueryIndexes.push(
      // `sourceCodesQueryIndex * 2` comes from the number of unique values in the insert query, `sourceCode.content` is used for the first two columns
      `(digest($${sourceCodesQueryIndex * 2 + 1}, 'sha256'), $${sourceCodesQueryIndex * 2 + 1}, $${sourceCodesQueryIndex * 2 + 2}::bytea)`,
    );
    sourceCodesQueryValues.push(sourceCode.content);
    sourceCodesQueryValues.push(sourceCode.source_hash_keccak);
  });
  const sourceCodesQuery = `INSERT INTO sources (
    source_hash,
    content,
    source_hash_keccak
  ) VALUES ${sourceCodesQueryIndexes.join(",")} ON CONFLICT (source_hash) DO NOTHING RETURNING *`;
  const sourceCodesQueryResult = await pool.query(
    sourceCodesQuery,
    sourceCodesQueryValues,
  );

  // If some source codes already exist, fetch their hashes from the database
  if (sourceCodesQueryResult.rows.length < sourcesInformation.length) {
    const existingSourcesQuery = `
      SELECT * 
      FROM sources
      WHERE source_hash = ANY($1::bytea[])
    `;
    const existingSourcesResult = await pool.query(existingSourcesQuery, [
      sourcesInformation.map((source) =>
        bytesFromString(
          createHash("sha256").update(source.content).digest("hex"),
        ),
      ),
    ]);
    sourceCodesQueryResult.rows = existingSourcesResult.rows;
  }

  const compiledContractsSourcesQueryIndexes: string[] = [];
  const compiledContractsSourcesQueryValues: any[] = [];

  // Loop through each `sourceInformation` to generate the query placeholders and values for the `INSERT INTO compiled_contracts_sources` query.
  // We separate these into two steps because we first need to batch insert into `sources`.
  // After that, we use the newly inserted `sources.source_hash` to perform the batch insert into `compiled_contracts_sources`.
  sourcesInformation.forEach(
    (compiledContractsSource, compiledContractsSourcesQueryIndex) => {
      compiledContractsSourcesQueryIndexes.push(
        // `sourceCodesQueryIndex * 3` comes from the number of unique values in the insert query
        `($${compiledContractsSourcesQueryIndex * 3 + 1}, $${compiledContractsSourcesQueryIndex * 3 + 2}, $${compiledContractsSourcesQueryIndex * 3 + 3})`,
      );
      compiledContractsSourcesQueryValues.push(compilation_id);
      const contentHash = createHash("sha256")
        .update(compiledContractsSource.content)
        .digest("hex");
      const source = sourceCodesQueryResult.rows.find(
        (sc) => sc.source_hash.toString("hex") === contentHash,
      );
      if (!source) {
        logger.error(
          "Source not found while inserting compiled contracts sources",
          {
            compilation_id,
            compiledContractsSource,
          },
        );
        throw new Error(
          "Source not found while inserting compiled contracts sources",
        );
      }
      compiledContractsSourcesQueryValues.push(source?.source_hash);
      compiledContractsSourcesQueryValues.push(compiledContractsSource.path);
    },
  );

  const compiledContractsSourcesQuery = `INSERT INTO compiled_contracts_sources (
    compilation_id,
    source_hash,
    path
  ) VALUES ${compiledContractsSourcesQueryIndexes.join(",")} ON CONFLICT (compilation_id, path) DO NOTHING`;
  await pool.query(
    compiledContractsSourcesQuery,
    compiledContractsSourcesQueryValues,
  );
}

export async function insertVerifiedContract(
  pool: PoolClient,
  schema: string,
  {
    compilation_id,
    deployment_id,
    creation_transformations,
    creation_values,
    runtime_transformations,
    runtime_values,
    runtime_match,
    creation_match,
    runtime_metadata_match,
    creation_metadata_match,
  }: Omit<Tables.VerifiedContract, "id">,
): Promise<QueryResult<Pick<Tables.VerifiedContract, "id">>> {
  let verifiedContractsInsertResult = await pool.query(
    `INSERT INTO ${schema}.verified_contracts (
        compilation_id,
        deployment_id,
        creation_transformations,
        creation_values,
        runtime_transformations,
        runtime_values,
        runtime_match,
        creation_match,
        runtime_metadata_match,
        creation_metadata_match
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (compilation_id, deployment_id) DO NOTHING RETURNING *`,
    [
      compilation_id,
      deployment_id,
      // transformations needs to be converted to string as a workaround:
      // arrays are not treated as jsonb types by pg module
      // then they are correctly stored as jsonb by postgresql
      creation_transformations
        ? JSON.stringify(creation_transformations)
        : null,
      creation_values,
      runtime_transformations ? JSON.stringify(runtime_transformations) : null,
      runtime_values,
      runtime_match,
      creation_match,
      runtime_metadata_match,
      creation_metadata_match,
    ],
  );
  if (verifiedContractsInsertResult.rows.length === 0) {
    verifiedContractsInsertResult = await pool.query(
      `
        SELECT
          id
        FROM ${schema}.verified_contracts
        WHERE 1=1
          AND compilation_id = $1
          AND deployment_id = $2
        `,
      [compilation_id, deployment_id],
    );
  }
  return verifiedContractsInsertResult;
}

export async function insertSourcifyMatch(
  pool: Pool,
  schema: string,
  {
    verified_contract_id,
    runtime_match,
    creation_match,
    metadata,
  }: Omit<Tables.SourcifyMatch, "created_at">,
) {
  await pool.query(
    `INSERT INTO ${schema}.sourcify_matches (
        verified_contract_id,
        creation_match,
        runtime_match,
        metadata
      ) VALUES ($1, $2, $3, $4)`,
    [verified_contract_id, creation_match, runtime_match, metadata],
  );
}

// Update sourcify_matches to the latest (and better) match in verified_contracts,
// you need to pass the old verified_contract_id to be updated.
// The old verified_contracts are not deleted from the verified_contracts table.
export async function updateSourcifyMatch(
  pool: Pool,
  schema: string,
  {
    verified_contract_id,
    runtime_match,
    creation_match,
    metadata,
  }: Omit<Tables.SourcifyMatch, "created_at">,
  oldVerifiedContractId: number,
) {
  await pool.query(
    `UPDATE ${schema}.sourcify_matches SET 
      verified_contract_id = $1,
      creation_match=$2,
      runtime_match=$3,
      metadata=$4
    WHERE  verified_contract_id = $5`,
    [
      verified_contract_id,
      creation_match,
      runtime_match,
      metadata,
      oldVerifiedContractId,
    ],
  );
}

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
  recompiledContract: CheckedContract,
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

export function prepareCompilerSettings(recompiledContract: CheckedContract) {
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

export async function countSourcifyMatchAddresses(
  pool: Pool,
  schema: string,
  chain: number,
): Promise<
  QueryResult<
    Pick<Tables.ContractDeployment, "chain_id"> & {
      full_total: number;
      partial_total: number;
    }
  >
> {
  return await pool.query(
    `
  SELECT
  contract_deployments.chain_id,
  CAST(SUM(CASE 
    WHEN COALESCE(sourcify_matches.creation_match, '') = 'perfect' OR sourcify_matches.runtime_match = 'perfect' THEN 1 ELSE 0 END) AS INTEGER) AS full_total,
  CAST(SUM(CASE 
    WHEN COALESCE(sourcify_matches.creation_match, '') != 'perfect' AND sourcify_matches.runtime_match != 'perfect' THEN 1 ELSE 0 END) AS INTEGER) AS partial_total
  FROM ${schema}.sourcify_matches
  JOIN ${schema}.verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
  JOIN ${schema}.contract_deployments ON contract_deployments.id = verified_contracts.deployment_id
  WHERE contract_deployments.chain_id = $1
  GROUP BY contract_deployments.chain_id;`,
    [chain],
  );
}

export async function getSourcifyMatchAddressesByChainAndMatch(
  pool: Pool,
  schema: string,
  chain: number,
  match: "full_match" | "partial_match" | "any_match",
  page: number,
  paginationSize: number,
  descending: boolean = false,
): Promise<QueryResult<{ address: string }>> {
  let queryWhere = "";
  switch (match) {
    case "full_match": {
      queryWhere =
        "WHERE COALESCE(sourcify_matches.creation_match, '') = 'perfect' OR sourcify_matches.runtime_match = 'perfect'";
      break;
    }
    case "partial_match": {
      queryWhere =
        "WHERE COALESCE(sourcify_matches.creation_match, '') != 'perfect' AND sourcify_matches.runtime_match != 'perfect'";
      break;
    }
    case "any_match": {
      queryWhere = "";
      break;
    }
    default: {
      throw new Error("Match type not supported");
    }
  }

  const orderBy = descending
    ? "ORDER BY verified_contracts.id DESC"
    : "ORDER BY verified_contracts.id ASC";

  return await pool.query(
    `
    SELECT
      concat('0x',encode(contract_deployments.address, 'hex')) as address
    FROM ${schema}.sourcify_matches
    JOIN ${schema}.verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
    JOIN ${schema}.contract_deployments ON 
        contract_deployments.id = verified_contracts.deployment_id
        AND contract_deployments.chain_id = $1
    ${queryWhere}
    ${orderBy}
    OFFSET $2 LIMIT $3
    `,
    [chain, page * paginationSize, paginationSize],
  );
}

export async function updateContractDeployment(
  pool: PoolClient,
  schema: string,
  {
    id,
    transaction_hash,
    block_number,
    txindex,
    deployer,
    contract_id,
  }: Omit<Tables.ContractDeployment, "chain_id" | "address">,
) {
  return await pool.query(
    `UPDATE ${schema}.contract_deployments 
     SET 
       transaction_hash = $2,
       block_number = $3,
       transaction_index = $4,
       deployer = $5,
       contract_id = $6
     WHERE id = $1`,
    [id, transaction_hash, block_number, txindex, deployer, contract_id],
  );
}
