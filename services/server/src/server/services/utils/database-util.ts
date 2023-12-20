import {
  CompiledContractArtifactsCborAuxdata,
  ImmutableReferences,
  Transformation,
  TransformationValues,
} from "@ethereum-sourcify/lib-sourcify";
import { Pool } from "pg";

type Hash = string;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Tables {
  export interface Code {
    bytecodeHash: Hash;
    bytecode: string;
  }
  export interface Contract {
    creationBytecodeHash: Hash;
    runtimeBytecodeHash: Hash;
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
    creationCodeHash: Hash;
    runtimeCodeHash: Hash;
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

  export interface SourcifyMatch {
    verifiedContractId: string;
    runtimeMatch: string | null;
    creationMatch: string | null;
  }
}

export interface DatabaseColumns {
  keccak256OnchainCreationBytecode: Hash;
  keccak256OnchainRuntimeBytecode: Hash;
  keccak256RecompiledCreationBytecode: Hash;
  keccak256RecompiledRuntimeBytecode: Hash;
  runtimeTransformations: Transformation[] | undefined;
  runtimeTransformationValues: TransformationValues | undefined;
  creationTransformations: Transformation[] | undefined;
  creationTransformationValues: TransformationValues | undefined;
  compilationTargetPath: string;
  compilationTargetName: string;
  language: string;
  compilationArtifacts: {
    abi: {};
    userdoc: any;
    devdoc: any;
    storageLayout: any;
  };
  creationCodeArtifacts: {
    sourceMap: string;
    linkReferences: {};
    cborAuxdata: CompiledContractArtifactsCborAuxdata | undefined;
  };
  runtimeCodeArtifacts: {
    sourceMap: string;
    linkReferences: {};
    immutableReferences: ImmutableReferences;
    cborAuxdata: CompiledContractArtifactsCborAuxdata | undefined;
  };
  runtimeMatch: boolean;
  creationMatch: boolean;
}

export async function getVerifiedContractByBytecodeHashes(
  pool: Pool,
  runtimeBytecodeHash: Hash,
  creationBytecodeHash: Hash
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
      JOIN contracts ON contracts.id = verified_contracts.contract_id
      JOIN contract_deployments ON 
        contract_deployments.contract_id = contracts.id 
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
  let verifiedContractsInsertResult = await pool.query(
    `INSERT INTO verified_contracts (
        compilation_id,
        contract_id,
        creation_transformations,
        creation_values,
        runtime_transformations,
        runtime_values,
        runtime_match,
        creation_match
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (compilation_id, contract_id) DO NOTHING RETURNING *`,
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
  if (verifiedContractsInsertResult.rows.length === 0) {
    verifiedContractsInsertResult = await pool.query(
      `
        SELECT
          id
        FROM verified_contracts
        WHERE 1=1
          AND compilationId = $1
          AND contractId = $2
        `,
      [compilationId, contractId]
    );
  }
  return verifiedContractsInsertResult;
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

export async function insertSourcifyMatch(
  pool: Pool,
  { verifiedContractId, runtimeMatch, creationMatch }: Tables.SourcifyMatch
) {
  await pool.query(
    `INSERT INTO sourcify_matches (
        verified_contract_id,
        creation_match,
        runtime_match
      ) VALUES ($1, $2, $3)`,
    [verifiedContractId, runtimeMatch, creationMatch]
  );
}

// Right now we are not updating, we are inserting every time a new match
export async function updateSourcifyMatch(
  pool: Pool,
  { verifiedContractId, runtimeMatch, creationMatch }: Tables.SourcifyMatch
) {
  await pool.query(
    `INSERT INTO sourcify_matches (
        verified_contract_id,
        creation_match,
        runtime_match
      ) VALUES ($1, $2, $3)`,
    [verifiedContractId, runtimeMatch, creationMatch]
  );
  // Delete previous match?
}
