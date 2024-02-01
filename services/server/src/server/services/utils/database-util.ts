import {
  CompiledContractCborAuxdata,
  ImmutableReferences,
  Transformation,
  TransformationValues,
} from "@ethereum-sourcify/lib-sourcify";
import { Pool } from "pg";

type Hash = string;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Tables {
  export interface Code {
    bytecode_hash: Hash;
    bytecode: string;
  }
  export interface Contract {
    creation_bytecode_hash: Hash;
    runtime_bytecode_hash: Hash;
  }
  export interface ContractDeployment {
    chain_id: string;
    address: string;
    transaction_hash: string;
    contract_id: string;
  }
  export interface CompiledContract {
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
    };
    sources: Object;
    compiler_settings: Object;
    creation_code_hash: Hash;
    runtime_code_hash: Hash;
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
    compilation_id: string;
    deployment_id: string;
    creation_transformations: Transformation[] | undefined;
    creation_transformation_values: TransformationValues | undefined;
    runtime_transformations: Transformation[] | undefined;
    runtime_transformation_values: TransformationValues | undefined;
    runtime_match: boolean;
    creation_match: boolean;
  }

  export interface SourcifyMatch {
    verified_contract_id: string;
    runtime_match: string | null;
    creation_match: string | null;
  }
}

export interface DatabaseColumns {
  bytecodeHashes: {
    recompiledCreation: Hash;
    recompiledRuntime: Hash;
    onchainCreation: Hash;
    onchainRuntime: Hash;
  };
  compiledContract: Partial<Tables.CompiledContract>;
  verifiedContract: Partial<Tables.VerifiedContract>;
}

export async function getVerifiedContractByBytecodeHashes(
  pool: Pool,
  runtime_bytecode_hash: Hash,
  creation_bytecode_hash: Hash
) {
  return await pool.query(
    `
      SELECT
        verified_contracts.*
      FROM verified_contracts
      JOIN contract_deployments ON contract_deployments.id = verified_contracts.deployment_id
      JOIN contracts ON contracts.id = contract_deployments.contract_id
      WHERE 1=1
        AND contracts.runtime_code_hash = $1
        AND contracts.creation_code_hash = $2
    `,
    [runtime_bytecode_hash, creation_bytecode_hash]
  );
}

export async function getSourcifyMatchByChainAddress(
  pool: Pool,
  chain: number,
  address: string,
  onlyPerfectMatches: boolean = false
) {
  return await pool.query(
    `
      SELECT
        sourcify_matches.*
      FROM sourcify_matches
      JOIN verified_contracts ON verified_contracts.id = sourcify_matches.verified_contract_id
      JOIN contract_deployments ON 
        contract_deployments.id = verified_contracts.deployment_id 
        AND contract_deployments.chain_id = $1 
        AND contract_deployments.address = $2
${
  onlyPerfectMatches
    ? "WHERE sourcify_matches.creation_match = 'perfect' OR sourcify_matches.runtime_match = 'perfect'"
    : ""
}
      ORDER BY
        CASE 
          WHEN sourcify_matches.creation_match = 'perfect' AND sourcify_matches.runtime_match = 'perfect' THEN 1
          WHEN sourcify_matches.creation_match = 'perfect' AND sourcify_matches.runtime_match = 'partial' THEN 2
          WHEN sourcify_matches.creation_match = 'partial' AND sourcify_matches.runtime_match = 'perfect' THEN 3
          WHEN sourcify_matches.creation_match = 'partial' AND sourcify_matches.runtime_match = 'partial' THEN 4
          ELSE 4
        END;
    `,
    [chain, address]
  );
}

export async function insertCode(
  pool: Pool,
  { bytecode_hash, bytecode }: Tables.Code
) {
  await pool.query(
    "INSERT INTO code (code_hash, code) VALUES ($1, $2) ON CONFLICT (code_hash) DO NOTHING",
    [bytecode_hash, bytecode]
  );
}

export async function insertContract(
  pool: Pool,
  { creation_bytecode_hash, runtime_bytecode_hash }: Tables.Contract
) {
  let contractInsertResult = await pool.query(
    "INSERT INTO contracts (creation_code_hash, runtime_code_hash) VALUES ($1, $2) ON CONFLICT (creation_code_hash, runtime_code_hash) DO NOTHING RETURNING *",
    [creation_bytecode_hash, runtime_bytecode_hash]
  );

  if (contractInsertResult.rows.length === 0) {
    contractInsertResult = await pool.query(
      `
      SELECT
        id
      FROM contracts
      WHERE creation_code_hash = $1 AND runtime_code_hash = $2
      `,
      [creation_bytecode_hash, runtime_bytecode_hash]
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
  }: Tables.ContractDeployment
) {
  let contractDeploymentInsertResult = await pool.query(
    "INSERT INTO contract_deployments (chain_id, address, transaction_hash, contract_id) VALUES ($1, $2, $3, $4) ON CONFLICT (chain_id, address, transaction_hash) DO NOTHING RETURNING *",
    [chain_id, address, transaction_hash, contract_id]
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
      [chain_id, address, transaction_hash]
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
  }: Tables.CompiledContract
) {
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
    ]
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
          AND creation_code_hash = $3
          AND runtime_code_hash = $4
        `,
      [compiler, language, creation_code_hash, runtime_code_hash]
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
    creation_transformation_values,
    runtime_transformations,
    runtime_transformation_values,
    runtime_match,
    creation_match,
  }: Tables.VerifiedContract
) {
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
      creation_transformation_values,
      JSON.stringify(runtime_transformations),
      runtime_transformation_values,
      runtime_match,
      creation_match,
    ]
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
      [compilation_id, deployment_id]
    );
  }
  return verifiedContractsInsertResult;
}

export async function updateVerifiedContract(
  pool: Pool,
  {
    compilation_id,
    deployment_id,
    creation_transformations,
    creation_transformation_values,
    runtime_transformations,
    runtime_transformation_values,
    runtime_match,
    creation_match,
  }: Tables.VerifiedContract
) {
  await pool.query(
    `
      UPDATE verified_contracts 
      SET 
        creation_transformations = $3,
        creation_values = $4,
        runtime_transformations = $5,
        runtime_values = $6,
        runtime_match = $7,
        creation_match = $8
      WHERE compilation_id = $1 AND deployment_id = $2
    `,
    [
      compilation_id,
      deployment_id,
      creation_transformations,
      creation_transformation_values,
      runtime_transformations,
      runtime_transformation_values,
      runtime_match,
      creation_match,
    ]
  );
}

export async function insertSourcifyMatch(
  pool: Pool,
  { verified_contract_id, runtime_match, creation_match }: Tables.SourcifyMatch
) {
  await pool.query(
    `INSERT INTO sourcify_matches (
        verified_contract_id,
        creation_match,
        runtime_match
      ) VALUES ($1, $2, $3)`,
    [verified_contract_id, runtime_match, creation_match]
  );
}

// Right now we are not updating, we are inserting every time a new match
export async function updateSourcifyMatch(
  pool: Pool,
  { verified_contract_id, runtime_match, creation_match }: Tables.SourcifyMatch
) {
  await pool.query(
    `INSERT INTO sourcify_matches (
        verified_contract_id,
        creation_match,
        runtime_match
      ) VALUES ($1, $2, $3)`,
    [verified_contract_id, runtime_match, creation_match]
  );
  // Delete previous match?
}
