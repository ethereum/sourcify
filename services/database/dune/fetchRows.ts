/* eslint-disable indent */
// conflict between prettier and eslint
import dotenv from "dotenv";
import pg from "pg";
import { InsertData } from "./DuneDataClient";
import {
  PgCode,
  PgCompiledContract,
  PgCompiledContractsSource,
  PgContract,
  PgContractDeployment,
  PgSource,
  PgSourcifyMatch,
  PgVerifiedContract,
} from "../pg-types";

dotenv.config();
const { Pool } = pg;

// Validate environment variables
if (
  !process.env.POSTGRES_HOST ||
  !process.env.POSTGRES_PORT ||
  !process.env.POSTGRES_USER ||
  !process.env.POSTGRES_DB ||
  !process.env.POSTGRES_PASSWORD
) {
  console.error(
    "Create a .env file containing all the needed environment variables for the database connection",
  );
  process.exit(2);
}

// Create a pool factory to avoid code duplication
function createPool() {
  return new Pool({
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT!),
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DB!,
  });
}

async function fetchWithQuery(table: string, customQuery?: string) {
  const pool = createPool();
  const defaultQuery = `
    SELECT *
    FROM ${table}
    LIMIT 1
  `;

  const queryToUse = customQuery || defaultQuery;
  try {
    const result = await pool.query(queryToUse);

    if (result.rows.length === 0) {
      console.log(`No ${table} found`);
      return null;
    }

    console.log(`Found ${result.rows.length} ${table}`);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching ${table}:`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

export async function fetchCode(): Promise<PgCode[] | null> {
  return fetchWithQuery("code");
}

export async function fetchCompiledContracts(): Promise<
  PgCompiledContract[] | null
> {
  // exclude compiled_contracts.sources
  const query = `
      SELECT
        id,
        created_at,
        updated_at,
        created_by,
        updated_by,
        compiler,
        version,
        language,
        name,
        fully_qualified_name,
        compiler_settings,
        compilation_artifacts,
        creation_code_hash,
        creation_code_artifacts,
        runtime_code_hash,
        runtime_code_artifacts
      FROM compiled_contracts
      LIMIT 1
    `;
  return fetchWithQuery("compiled_contracts", query);
}

export async function fetchCompiledContractsSources(): Promise<
  PgCompiledContractsSource[] | null
> {
  return fetchWithQuery("compiled_contracts_sources");
}

export async function fetchContractDeployments(): Promise<
  PgContractDeployment[] | null
> {
  return fetchWithQuery("contract_deployments");
}

export async function fetchContracts(): Promise<PgContract[] | null> {
  return fetchWithQuery("contracts");
}

export async function fetchSources(): Promise<PgSource[] | null> {
  return fetchWithQuery("sources");
}

export async function fetchSourcifyMatches(): Promise<
  PgSourcifyMatch[] | null
> {
  return fetchWithQuery("sourcify_matches");
}

export async function fetchVerifiedContracts(): Promise<
  PgVerifiedContract[] | null
> {
  return fetchWithQuery("verified_contracts");
}

// Helper function to fetch all data
export async function fetchAllData() {
  const [
    code,
    compiledContracts,
    compiledContractsSources,
    contractDeployments,
    contracts,
    sources,
    sourcifyMatches,
    verifiedContracts,
  ] = await Promise.all([
    fetchCode(),
    fetchCompiledContracts(),
    fetchCompiledContractsSources(),
    fetchContractDeployments(),
    fetchContracts(),
    fetchSources(),
    fetchSourcifyMatches(),
    fetchVerifiedContracts(),
  ]);

  return {
    code: code || undefined,
    compiled_contracts: compiledContracts || undefined,
    compiled_contracts_sources: compiledContractsSources || undefined,
    contract_deployments: contractDeployments || undefined,
    contracts: contracts || undefined,
    sources: sources || undefined,
    sourcify_matches: sourcifyMatches || undefined,
    verified_contracts: verifiedContracts || undefined,
  };
}
