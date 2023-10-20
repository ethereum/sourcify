import { AuthTypes, Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Tables {
  export interface Code {
    bytecodeHash: string;
    bytecode: string;
  }
  export interface Contract {
    creationBytecodeHash: string;
    runtimeBytecodeHash: string;
  }
  export interface ContractDeployment {
    chainId: string;
    address: string;
    transactionHash: string;
    contractId: string;
  }
  export interface CompiledContract {
    compiler: string;
    version: string;
    language: string;
    name: string;
    fullyQualifiedName: string;
    compilationArtifacts: Object;
    sources: Object;
    compilerSettings: Object;
    creationCodeHash: string;
    runtimeCodeHash: string;
    creationCodeArtifacts: Object;
    runtimeCodeArtifacts: Object;
  }
  export interface VerifiedContract {
    compilationId: string;
    contractId: string;
    creationTransformations: string;
    creationTransformationValues: Object;
    runtimeTransformations: string;
    runtimeTransformationValues: Object;
    runtimeMatch: boolean;
    creationMatch: boolean;
  }
}

export async function getPool(): Promise<Pool> {
  if (process.env.GOOGLE_CLOUD_SQL_INSTANCE_NAME) {
    const connector = new Connector();
    const clientOpts = await connector.getOptions({
      instanceConnectionName: process.env.GOOGLE_CLOUD_SQL_INSTANCE_NAME, // "verifier-alliance:europe-west3:test-verifier-alliance",
      authType: AuthTypes.IAM,
    });
    return new Pool({
      ...clientOpts,
      user: process.env.GOOGLE_CLOUD_SQL_IAM_ACCOUNT, // "marco.castignoli@ethereum.org",
      database: process.env.GOOGLE_CLOUD_SQL_DATABASE, // "postgres",
      max: 5,
    });
  } else if (process.env.POSTGRES_HOST) {
    return new Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT as string),
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
    });
  } else {
    throw new Error("Cannot initialize Alliance Database pool");
  }
}

export async function getVerifiedContractByBytecodeHashes(
  pool: Pool,
  runtimeBytecodeHash: string,
  creationBytecodeHash: string
) {
  return await pool.query(
    `
      SELECT
        verified_contracts.*
      FROM verified_contracts
      JOIN contracts ON contracts.id = verified_contracts.contract_id
      WHERE 1=1
        AND contracts.runtime_code_hash = $1
        AND contracts.creation_code_hash = $2
    `,
    [runtimeBytecodeHash, creationBytecodeHash]
  );
}

export async function insertCode(
  pool: Pool,
  { bytecodeHash, bytecode }: Tables.Code
) {
  await pool.query(
    "INSERT INTO code (code_hash, code) VALUES ($1, $2) ON CONFLICT (code_hash) DO NOTHING",
    [bytecodeHash, bytecode]
  );
}

export async function insertContract(
  pool: Pool,
  { creationBytecodeHash, runtimeBytecodeHash }: Tables.Contract
) {
  let contractInsertResult = await pool.query(
    "INSERT INTO contracts (creation_code_hash, runtime_code_hash) VALUES ($1, $2) ON CONFLICT (creation_code_hash, runtime_code_hash) DO NOTHING RETURNING *",
    [creationBytecodeHash, runtimeBytecodeHash]
  );

  if (contractInsertResult.rows.length === 0) {
    contractInsertResult = await pool.query(
      `
      SELECT
        id
      FROM contracts
      WHERE creation_code_hash = $1 AND runtime_code_hash = $2
      `,
      [creationBytecodeHash, runtimeBytecodeHash]
    );
  }
  return contractInsertResult;
}

export async function insertContractDeployment(
  pool: Pool,
  { chainId, address, transactionHash, contractId }: Tables.ContractDeployment
) {
  await pool.query(
    "INSERT INTO contract_deployments (chain_id, address, transaction_hash, contract_id) VALUES ($1, $2, $3, $4) ON CONFLICT (chain_id, address, transaction_hash) DO NOTHING",
    [chainId, address, transactionHash, contractId]
  );
}

export async function insertCompiledContract(
  pool: Pool,
  {
    compiler,
    version,
    language,
    name,
    fullyQualifiedName,
    compilationArtifacts,
    sources,
    compilerSettings,
    creationCodeHash,
    runtimeCodeHash,
    creationCodeArtifacts,
    runtimeCodeArtifacts,
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
      fullyQualifiedName,
      compilationArtifacts,
      sources,
      compilerSettings,
      creationCodeHash,
      runtimeCodeHash,
      creationCodeArtifacts,
      runtimeCodeArtifacts,
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
      [compiler, language, creationCodeHash, runtimeCodeHash]
    );
  }
  return compiledContractsInsertResult;
}

export async function insertVerifiedContract(
  pool: Pool,
  {
    compilationId,
    contractId,
    creationTransformations,
    creationTransformationValues,
    runtimeTransformations,
    runtimeTransformationValues,
    runtimeMatch,
    creationMatch,
  }: Tables.VerifiedContract
) {
  await pool.query(
    `INSERT INTO verified_contracts (
        compilation_id,
        contract_id,
        creation_transformations,
        creation_values,
        runtime_transformations,
        runtime_values,
        runtime_match,
        creation_match
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      compilationId,
      contractId,
      creationTransformations,
      creationTransformationValues,
      runtimeTransformations,
      runtimeTransformationValues,
      runtimeMatch,
      creationMatch,
    ]
  );
}

export async function updateVerifiedContract(
  pool: Pool,
  {
    compilationId,
    contractId,
    creationTransformations,
    creationTransformationValues,
    runtimeTransformations,
    runtimeTransformationValues,
    runtimeMatch,
    creationMatch,
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
      WHERE compilation_id = $1 AND contract_id = $2
    `,
    [
      compilationId,
      contractId,
      creationTransformations,
      creationTransformationValues,
      runtimeTransformations,
      runtimeTransformationValues,
      runtimeMatch,
      creationMatch,
    ]
  );
}
