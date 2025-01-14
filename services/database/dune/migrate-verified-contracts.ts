import dotenv from "dotenv";
import path from "path";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const { Pool } = pg;

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

interface VerifiedContract {
  id: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
  deployment_id: string;
  compilation_id: string;
  creation_match: boolean;
  creation_values: any | null;
  creation_transformations: any | null;
  runtime_match: boolean;
  runtime_values: any | null;
  runtime_transformations: any | null;
  runtime_metadata_match: boolean | null;
  creation_metadata_match: boolean | null;
}

export async function fetchVerifiedContract(): Promise<VerifiedContract | null> {
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

    const verifiedContract = result.rows[0];
    console.log("Found verified contract:", verifiedContract.id);
    return verifiedContract;
  } catch (error) {
    console.error("Error fetching verified contract:", error);
    throw error;
  } finally {
    await pool.end();
  }
}
