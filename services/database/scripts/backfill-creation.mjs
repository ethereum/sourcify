/**
 * Backfill Creation Script
 *
 * This script identifies and tracks contracts that are missing transaction hashes in the database.
 * It creates a table 'missing_transaction_hash' if it doesn't exist and populates it with contracts
 * that have null or empty transaction hashes.
 *
 * Usage:
 *   node backfill-creation.mjs [options]
 *
 * Options:
 *   -l, --limit <number>  Limit the number of contracts to process
 *   -d, --dry-run        Only show results without writing to database
 *   -h, --help          Display help information
 *
 * Environment Variables Required:
 *   - POSTGRES_HOST
 *   - POSTGRES_PORT
 *   - POSTGRES_DB
 *   - POSTGRES_USER
 *   - POSTGRES_PASSWORD
 *
 * @module BackfillCreation
 */

import { program } from "commander";
import dotenv from "dotenv";
import pg from "pg";
import sourcifyChains from "../../server/src/sourcify-chains-default.json" with { type: "json" };
import fetch from "node-fetch";
import { logger } from "./logger.js";
import { ContractVerifier } from "./ContractVerifier.mjs";

const { Pool } = pg;
dotenv.config({ path: "../.env" });

logger.debug("Starting backfill-creation script", {
  moduleName: "BackfillCreation",
});

// Get supported chain IDs from sourcify-chains-default.json
const supportedChainIds = Object.entries(sourcifyChains)
  .filter(
    ([_, data]) =>
      data.supported === true &&
      data.fetchContractCreationTxUsing && // No point to verify contracts in chains we can't get the creation tx
      !data.fetchContractCreationTxUsing.blockscoutScrape, // Blockscout scraping almost always fails
    // TODO: We should implement the binary search for creation tx
  )
  .map(([chainId]) => chainId);

logger.debug("Supported chains", {
  moduleName: "BackfillCreation",
  chainIds: supportedChainIds.join(","),
});

const createMissingTxTable = async (pool) => {
  const query = `
    CREATE TABLE IF NOT EXISTS missing_transaction_hash (
      id SERIAL PRIMARY KEY,
      chain_id numeric NOT NULL,
      address bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      reverified boolean DEFAULT false,
      CONSTRAINT missing_transaction_hash_unique UNIQUE (chain_id, address)
    );
  `;

  try {
    await pool.query(query);
    logger.info("Created missing_transaction_hash table if it didn't exist");
  } catch (err) {
    logger.error("Error creating table", { error: err });
    throw err;
  }
};

const findMissingTxHashes = async (pool, options) => {
  const query = `
    SELECT 
      cd.chain_id,
      cd.address,
      cd.transaction_hash
    FROM contract_deployments cd
    WHERE cd.transaction_hash = '\\x'
      OR cd.transaction_hash IS NULL
      AND cd.chain_id = ANY($1)
    ${options.limit ? "LIMIT $2" : ""}
  `;

  const params = [supportedChainIds];
  if (options.limit) {
    params.push(options.limit);
  }

  try {
    const result = await pool.query(query, params);
    logger.info(
      `Found ${result.rows.length} contracts missing transaction hashes`,
    );
    return result.rows;
  } catch (err) {
    logger.error("Error querying contracts", { error: err.message });
    throw err;
  }
};

const insertMissingTxHashes = async (pool, contracts) => {
  const query = `
    INSERT INTO missing_transaction_hash (chain_id, address)
    SELECT * FROM UNNEST($1::numeric[], $2::bytea[])
    ON CONFLICT (chain_id, address) DO NOTHING
  `;

  try {
    const chainIds = contracts.map((c) => c.chain_id);
    const addresses = contracts.map((c) => c.address);

    const result = await pool.query(query, [chainIds, addresses]);
    logger.info(`Successfully inserted ${result.rowCount} contracts`);
  } catch (err) {
    logger.error("Error batch inserting contracts", {
      error: err.message,
      contractCount: contracts.length,
    });
    throw err;
  }
};

// Add at the top of the file, after imports
let activePool = null;

// Add before program.parse
process.on("SIGINT", async () => {
  logger.info("Received SIGINT (Ctrl+C). Cleaning up...");
  if (activePool) {
    try {
      await activePool.end();
      logger.info("Successfully closed database pool");
    } catch (err) {
      logger.error("Error closing pool", { error: err.message });
    }
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM. Cleaning up...");
  if (activePool) {
    try {
      await activePool.end();
      logger.info("Successfully closed database pool");
    } catch (err) {
      logger.error("Error closing pool", { error: err.message });
    }
  }
  process.exit(0);
});

// Update the verify command to use the imported class
program
  .command("verify")
  .description(
    "Verify contracts using source files and metadata\n" +
      "Logging level can be configured using NODE_LOG_LEVEL environment variable (default: 'info')\n\n" +
      "Example:\n" +
      "NODE_LOG_LEVEL=debug node backfill-creation.mjs verify \\\n" +
      "  --server=https://sourcify.dev/server/ \\\n" +
      "  --batch-size=400 \\\n" +
      "  --concurrent=200 \\\n" +
      "  --interval=100 \\\n" +
      "  --chains=10",
  )
  .requiredOption("-s, --server <url>", "Sourcify server URL")
  .option(
    "-b, --batch-size <number>",
    "Number of contracts to fetch at once",
    (value) => parseInt(value) || 100,
    100,
  )
  .option(
    "-c, --concurrent <number>",
    "Number of concurrent verifications",
    (value) => parseInt(value) || 5,
    5,
  )
  .option(
    "--cold-start-seconds <number>",
    "Number of seconds to ramp up concurrency to the given max value. Will use a logarithmic ramp up.",
    (value) => parseInt(value) || 300,
    300,
  )
  .option(
    "-i, --interval <number>",
    "Interval in milliseconds to wait between checking if a new contract can be verified concurrently",
    (value) => parseInt(value) || 100,
    100,
  )
  .option(
    "-l, --limit <number>",
    "Limit the number of contracts to verify",
    parseInt,
    Number.MAX_SAFE_INTEGER,
  )
  .option(
    "--chains <chains>",
    "Comma-separated list of chain IDs to verify. If not provided, all supported chains will be verified.",
    (value) => value.split(",").map(Number),
  )
  .action(async (options) => {
    activePool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    });

    try {
      const verifier = new ContractVerifier(activePool, options);
      await verifier.run();
      await activePool.end();
      activePool = null;
      process.exit(0);
    } catch (err) {
      logger.error("Script failed", { error: err.message });
      if (activePool) {
        await activePool.end();
        activePool = null;
      }
      process.exit(1);
    }
  });

program
  .command("find-missing-tx-hashes")
  .description("Find contracts missing transaction hashes and track them")
  .option("-l, --limit <number>", "Limit the number of contracts to process")
  .option("-d, --dry-run", "Only show results without writing to database")
  .action(async (options) => {
    const pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    });

    try {
      if (!options.dryRun) {
        await createMissingTxTable(pool);
      }

      const missingTxContracts = await findMissingTxHashes(pool, options);

      if (options.dryRun) {
        logger.info("Dry run results:", {
          totalContracts: missingTxContracts.length,
          sampleContract: missingTxContracts[0]
            ? {
                chainId: missingTxContracts[0].chain_id,
                address: `0x${missingTxContracts[0].address.toString("hex")}`,
              }
            : null,
        });
      } else {
        await insertMissingTxHashes(pool, missingTxContracts);
      }
    } catch (err) {
      logger.error("Script failed", { error: err.message });
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

program.parse(process.argv);
