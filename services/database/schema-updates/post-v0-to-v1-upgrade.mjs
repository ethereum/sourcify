// This script is used to finish the upgrade of the database schema from v0 to v1
// The sources table is filled but the source_hash_keccak column is empty
// This script fills the source_hash_keccak column with the keccak256 hash of the source

import pg from "pg";
import { keccak256 } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});
const schema = process.env.POSTGRES_SCHEMA || "public";

const BATCH_SIZE = process.env.BATCH_SIZE || 1000;

async function updateSourceHashes() {
  const client = await pool.connect();

  try {
    let processedRows = 0;
    let totalRows = 0;

    do {
      await client.query("BEGIN");

      // Fetch a batch of rows
      const result = await client.query(
        `
        SELECT source_hash, content
        FROM ${schema}.sources
        WHERE source_hash_keccak = ''
        LIMIT $1
      `,
        [BATCH_SIZE],
      );

      totalRows = result.rows.length;

      if (totalRows > 0) {
        // Prepare batch update data
        const updateValues = result.rows
          .map((row, index) => {
            return `($${index * 2 + 1}::bytea, $${index * 2 + 2}::bytea)`;
          })
          .join(",");

        const flatParams = result.rows.flatMap((row) => {
          const contentHash = keccak256(Buffer.from(row.content));
          return [Buffer.from(contentHash.slice(2), "hex"), row.source_hash];
        });

        // Perform batch update
        await client.query(
          `
          UPDATE ${schema}.sources AS s
          SET source_hash_keccak = c.hash
          FROM (VALUES ${updateValues}) AS c(hash, source_hash)
          WHERE s.source_hash = c.source_hash
        `,
          flatParams,
        );

        processedRows += totalRows;
        console.log(`Processed ${processedRows} rows`);
      }

      await client.query("COMMIT");
    } while (totalRows === BATCH_SIZE);

    console.log(`Finished processing ${processedRows} rows in total`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating source hashes:", error);
  } finally {
    client.release();
  }
}

updateSourceHashes()
  .then(() => {
    console.log("Source hash update complete");
  })
  .catch((error) => {
    console.error("Error in updateSourceHashes:", error);
  })
  .finally(() => {
    pool.end();
  });
