import {
  CheckedContract,
  CompiledContractCborAuxdata,
  ImmutableReferences,
  Libraries,
  Match,
  Metadata,
  Status,
  Transformation,
  TransformationValues,
} from "@ethereum-sourcify/lib-sourcify";
import { Pool, QueryResult } from "pg";
import { Bytes, BytesSha, BytesKeccak, BytesTypes } from "../../types";

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
      abi: {};
      userdoc: any;
      devdoc: any;
      storageLayout: any;
      sources: any;
    };
    sources: Record<string, string>;
    compiler_settings: Object;
    creation_code_hash?: BytesSha;
    runtime_code_hash: BytesSha;
    creation_code_artifacts: {
      sourceMap: string;
      linkReferences: {};
      cborAuxdata: CompiledContractCborAuxdata | undefined;
    };
    runtime_code_artifacts: {
      sourceMap: string;
      linkReferences: {};
      immutableReferences: ImmutableReferences;
      cborAuxdata: CompiledContractCborAuxdata | undefined;
    };
  }
  export interface VerifiedContract {
    id: number;
    compilation_id: string;
    deployment_id: string;
    creation_transformations: Transformation[] | undefined;
    creation_values: TransformationValues | undefined;
    runtime_transformations: Transformation[] | undefined;
    runtime_values: TransformationValues | undefined;
    runtime_match: boolean;
    creation_match: boolean;
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

export interface DatabaseColumns {
  bytecodeHashes: {
    keccak: {
      recompiledCreation?: BytesKeccak;
      recompiledRuntime: BytesKeccak;
      onchainCreation?: BytesKeccak;
      onchainRuntime: BytesKeccak;
    };
  };
  compiledContract: Pick<
    Tables.CompiledContract,
    | "language"
    | "fully_qualified_name"
    | "compilation_artifacts"
    | "creation_code_artifacts"
    | "runtime_code_artifacts"
  >;
  verifiedContract: Pick<
    Tables.VerifiedContract,
    | "runtime_transformations"
    | "creation_transformations"
    | "runtime_values"
    | "creation_values"
    | "runtime_match"
    | "creation_match"
  >;
}

export type GetVerifiedContractByChainAndAddressResult =
  Tables.VerifiedContract & {
    transaction_hash: Bytes | null;
    contract_id: string;
  };

export async function getVerifiedContractByChainAndAddress(
  pool: Pool,
  chain: number,
  address: Bytes,
): Promise<QueryResult<GetVerifiedContractByChainAndAddressResult>> {
  return await pool.query(
    `
      SELECT
        verified_contracts.*,
        contract_deployments.transaction_hash,
        contract_deployments.contract_id
      FROM verified_contracts
      JOIN contract_deployments ON contract_deployments.id = verified_contracts.deployment_id
      WHERE 1=1
        AND contract_deployments.chain_id = $1
        AND contract_deployments.address = $2
    `,
    [chain, address],
  );
}

export type GetSourcifyMatchByChainAddressResult = Tables.SourcifyMatch &
  Pick<Tables.VerifiedContract, "creation_values" | "runtime_values"> &
  Pick<Tables.CompiledContract, "runtime_code_artifacts" | "sources"> &
  Pick<Tables.ContractDeployment, "transaction_hash">;

export async function getSourcifyMatchByChainAddress(
  pool: Pool,
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
        compiled_contracts.sources,
        verified_contracts.creation_values,
        verified_contracts.runtime_values,
        compiled_contracts.runtime_code_artifacts,
        contract_deployments.transaction_hash
      FROM sourcify_matches
      JOIN verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
      JOIN compiled_contracts ON compiled_contracts.id = verified_contracts.compilation_id
      JOIN contract_deployments ON 
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

export async function insertCode(
  pool: Pool,
  { bytecode_hash_keccak, bytecode }: Omit<Tables.Code, "bytecode_hash">,
): Promise<QueryResult<Pick<Tables.Code, "bytecode_hash">>> {
  let codeInsertResult = await pool.query(
    "INSERT INTO code (code_hash, code, code_hash_keccak) VALUES (digest($1::bytea, 'sha3-256'), $1::bytea, $2) ON CONFLICT (code_hash) DO NOTHING RETURNING code_hash as bytecode_hash",
    [bytecode, bytecode_hash_keccak],
  );

  // If there is a conflict (ie. code already exists), the response will be empty. We still need to return the object to fill other tables
  if (codeInsertResult.rows.length === 0) {
    codeInsertResult = await pool.query(
      `SELECT
        code_hash as bytecode_hash
      FROM code
      WHERE code_hash = digest($1::bytea, 'sha3-256')`,
      [bytecode],
    );
  }
  return codeInsertResult;
}

export async function insertContract(
  pool: Pool,
  {
    creation_bytecode_hash,
    runtime_bytecode_hash,
  }: Omit<Tables.Contract, "id">,
): Promise<QueryResult<Pick<Tables.Contract, "id">>> {
  let contractInsertResult = await pool.query(
    "INSERT INTO contracts (creation_code_hash, runtime_code_hash) VALUES ($1, $2) ON CONFLICT (creation_code_hash, runtime_code_hash) DO NOTHING RETURNING *",
    [creation_bytecode_hash, runtime_bytecode_hash],
  );

  if (contractInsertResult.rows.length === 0) {
    contractInsertResult = await pool.query(
      `
      SELECT
        id
      FROM contracts
      WHERE creation_code_hash = $1 AND runtime_code_hash = $2
      `,
      [creation_bytecode_hash, runtime_bytecode_hash],
    );
  }
  return contractInsertResult;
}

export async function insertContractDeployment(
  pool: Pool,
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
      contract_deployments (
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
      FROM contract_deployments
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
  pool: Pool,
  {
    compiler,
    version,
    language,
    name,
    fully_qualified_name,
    compilation_artifacts,
    sources,
    compiler_settings,
    creation_code_hash,
    runtime_code_hash,
    creation_code_artifacts,
    runtime_code_artifacts,
  }: Omit<Tables.CompiledContract, "id">,
): Promise<QueryResult<Pick<Tables.CompiledContract, "id">>> {
  let compiledContractsInsertResult = await pool.query(
    `
      INSERT INTO compiled_contracts (
        compiler,
        version,
        language,
        name,
        fully_qualified_name,
        compilation_artifacts,
        sources,
        compiler_settings,
        creation_code_hash,
        runtime_code_hash,
        creation_code_artifacts,
        runtime_code_artifacts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (compiler, language, creation_code_hash, runtime_code_hash) DO NOTHING RETURNING *
    `,
    [
      compiler,
      version,
      language,
      name,
      fully_qualified_name,
      compilation_artifacts,
      sources,
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
        FROM compiled_contracts
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

export async function insertVerifiedContract(
  pool: Pool,
  {
    compilation_id,
    deployment_id,
    creation_transformations,
    creation_values,
    runtime_transformations,
    runtime_values,
    runtime_match,
    creation_match,
  }: Omit<Tables.VerifiedContract, "id">,
): Promise<QueryResult<Pick<Tables.VerifiedContract, "id">>> {
  let verifiedContractsInsertResult = await pool.query(
    `INSERT INTO verified_contracts (
        compilation_id,
        deployment_id,
        creation_transformations,
        creation_values,
        runtime_transformations,
        runtime_values,
        runtime_match,
        creation_match
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (compilation_id, deployment_id) DO NOTHING RETURNING *`,
    [
      compilation_id,
      deployment_id,
      JSON.stringify(creation_transformations),
      creation_values,
      JSON.stringify(runtime_transformations),
      runtime_values,
      runtime_match,
      creation_match,
    ],
  );
  if (verifiedContractsInsertResult.rows.length === 0) {
    verifiedContractsInsertResult = await pool.query(
      `
        SELECT
          id
        FROM verified_contracts
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
  {
    verified_contract_id,
    runtime_match,
    creation_match,
    metadata,
  }: Omit<Tables.SourcifyMatch, "created_at">,
) {
  await pool.query(
    `INSERT INTO sourcify_matches (
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
  {
    verified_contract_id,
    runtime_match,
    creation_match,
    metadata,
  }: Omit<Tables.SourcifyMatch, "created_at">,
  oldVerifiedContractId: number,
) {
  await pool.query(
    `UPDATE sourcify_matches SET 
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
  FROM sourcify_matches
  JOIN verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
  JOIN contract_deployments ON contract_deployments.id = verified_contracts.deployment_id
  WHERE contract_deployments.chain_id = $1
  GROUP BY contract_deployments.chain_id;`,
    [chain],
  );
}

export async function getSourcifyMatchAddressesByChainAndMatch(
  pool: Pool,
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
    FROM sourcify_matches
    JOIN verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
    JOIN contract_deployments ON 
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
  pool: Pool,
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
    `UPDATE contract_deployments 
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
