import dotenv from "dotenv";
import pg from "pg";
import { VerifiedContract } from "../pg-types";
import { InsertData } from "./DuneDataClient";

dotenv.config();

const { Pool } = pg;

console.log(__dirname);
console.log(process.env.POSTGRES_HOST);

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

export async function fetchVerifiedContracts(): Promise<
  VerifiedContract[] | null
> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT!),
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DB!,
  });

  try {
    console.log("Fetching verified contracts...");
    const result = await pool.query(`
      SELECT 
        vc.id,
        vc.created_at,
        vc.updated_at,
        vc.created_by,
        vc.updated_by,
        vc.deployment_id,
        vc.compilation_id,
        vc.creation_match,
        vc.creation_values,
        vc.creation_transformations,
        vc.runtime_match,
        vc.runtime_values,
        vc.runtime_transformations,
        vc.runtime_metadata_match,
        vc.creation_metadata_match
      FROM verified_contracts vc
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log("No verified contracts found");
      return null;
    }

    const verifiedContracts = result.rows as VerifiedContract[];
    console.log("Found verified contracts:", verifiedContracts.length);
    return verifiedContracts;
  } catch (error) {
    console.error("Error fetching verified contract:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

export function formatVerifiedContracts(
  verifiedContracts: VerifiedContract[],
): InsertData["verified_contracts"] {
  return verifiedContracts.map((row) => ({
    ...row,
    id: parseInt(row.id),
    creation_values: JSON.stringify(row.creation_values),
    creation_transformations: JSON.stringify(row.creation_transformations),
    runtime_values: JSON.stringify(row.runtime_values),
    runtime_transformations: JSON.stringify(row.runtime_transformations),
  }));
}
