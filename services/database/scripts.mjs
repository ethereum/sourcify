import { program } from "commander";
import dotenv from "dotenv";
import readdirp from "readdirp";
import pg from "pg";
import path from "path";
import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Convert the URL to a file path and get the directory name. Workaround for .mjs scripts
const __dirname = dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;
const { readFile } = fs.promises;

dotenv.config();

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

program
  .command("import-repo")
  .description("Import repository_v1 to Sourcify's sourcify_sync table")
  .argument(
    "<string>",
    "Path to repository v1 contracts folder (e.g. /Users/user/sourcify/repository/contracts)",
  )
  .option("-sf, --start-from [number]", "Start from a specific timestamp (ms)")
  .option("-un, --until [number]", "Stop at a specific timestamp (ms)")
  .action(async (repositoryV1Path, options) => {
    const INSERT_CHUNK_SIZE = 10000;

    if (path.parse(repositoryV1Path).base !== "contracts") {
      console.error(
        "Passed repositoryV1 path is not correct: " + repositoryV1Path,
      );
      process.exit(4);
    }

    let contractsSorted;

    // 1. Read contracts from repository
    try {
      let contracts = [];

      console.log("Reading from " + repositoryV1Path);

      let dirCount = 0;
      const dirCountToReport = 100000;
      for await (const entry of readdirp(repositoryV1Path, {
        alwaysStat: true,
        depth: 2,
        type: "directories",
      })) {
        const pathParts = entry.fullPath.split("/");
        const address = pathParts.pop();
        const chainId = pathParts.pop();
        const matchType = pathParts.pop();

        if (
          (matchType === "full_match" || matchType === "partial_match") &&
          isNumber(chainId)
        ) {
          contracts.push({
            chainId,
            address,
            timestamp: entry.stats.birthtime,
            matchType,
          });

          dirCount++;
        }

        if (dirCount % dirCountToReport === 0 && dirCount > 0) {
          console.log(
            new Date() + " - Read " + dirCount + " contract directories",
          );
        }
      }

      console.log(
        new Date() +
          " - Finished reading " +
          dirCount +
          " contract directories",
      );

      contractsSorted = contracts.sort(
        (o1, o2) => o1.timestamp.getTime() - o2.timestamp.getTime(),
      );

      if (options.startFrom) {
        contractsSorted = contractsSorted.filter(
          (obj) => obj.timestamp.getTime() > options.startFrom,
        );
      }

      if (options.until) {
        contractsSorted = contractsSorted.filter(
          (obj) => obj.timestamp.getTime() < options.until,
        );
      }

      console.log(
        `Filtered ${contracts.length} contracts to ${contractsSorted.length}`,
      );
    } catch (e) {
      console.error(
        "Error while reading and formatting files from the repository",
      );
      console.error(e);
      process.exit(3);
    }

    // 2. Insert contracts to sourcify_sync table

    console.log("Inserting contracts to sourcify_sync table");
    const databasePool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
    });
    try {
      // Splitting contracts array into chunks
      console.log(
        `Splitting ${contractsSorted.length} contracts into chunks of ${INSERT_CHUNK_SIZE} contracts`,
      );
      const contractChunks = chunkArray(contractsSorted, INSERT_CHUNK_SIZE);
      console.log(`Number of chunks created: ${contractChunks.length}`);
      for (let i = 0; i < contractChunks.length; i++) {
        const chunk = contractChunks[i];
        const startTime = Date.now();
        await insertContractsBatch(chunk, databasePool);
        const elapsedTime = Date.now() - startTime;
        console.log(
          `Processed chunk ${i + 1}/${contractChunks.length} in ${elapsedTime} ms`,
        );
      }
      databasePool.end();
    } catch (e) {
      console.error("Error while storing contracts in the database", e);
      process.exit(3);
    }
  });

program
  .command("import-creator-tx-hash")
  .description(
    "Import repository_v1 creator-tx-hash.txt files to Sourcify's sourcify_transaction_hash table",
  )
  .argument(
    "<string>",
    "Path to repository v1 contracts folder (e.g. /Users/user/sourcify/repository/contracts)",
  )
  .action(async (repositoryV1Path, options) => {
    const INSERT_CHUNK_SIZE = 10000;

    if (path.parse(repositoryV1Path).base !== "contracts") {
      console.error(
        "Passed repositoryV1 path is not correct: " + repositoryV1Path,
      );
      process.exit(4);
    }

    let contracts = [];

    // 1. Read contracts from repository
    try {
      console.log("Reading from " + repositoryV1Path);

      let dirCount = 0;
      const dirCountToReport = 100000;
      for await (const entry of readdirp(repositoryV1Path, {
        alwaysStat: true,
        depth: 3,
        type: "files",
        fileFilter: "creator-tx-hash.txt",
      })) {
        const pathParts = entry.fullPath.split("/");
        const creatorTxHash_ = pathParts.pop();
        const address = pathParts.pop();
        const chainId = pathParts.pop();
        const matchType = pathParts.pop();

        let creatorTxHash;
        try {
          creatorTxHash = (
            await fs.promises.readFile(entry.fullPath)
          ).toString();
        } catch (e) {
          console.error(
            "Cannot read file",
            JSON.stringify(
              {
                address,
                chainId,
                matchType,
              },
              undefined,
              2,
            ),
          );
        }

        if (
          (matchType === "full_match" || matchType === "partial_match") &&
          isNumber(chainId) &&
          creatorTxHash
        ) {
          contracts.push({
            chainId,
            address,
            creatorTxHash,
          });

          dirCount++;
        }

        if (dirCount % dirCountToReport === 0 && dirCount > 0) {
          console.log(
            new Date() + " - Read " + dirCount + " contract directories",
          );
        }
      }

      console.log(
        new Date() +
          " - Finished reading " +
          dirCount +
          " contract directories",
      );
    } catch (e) {
      console.error(
        "Error while reading and formatting files from the repository",
      );
      console.error(e);
      process.exit(3);
    }

    // 2. Insert contracts to sourcify_transaction_hash table
    console.log("Inserting contracts to sourcify_transaction_hash table");
    const databasePool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
    });
    try {
      // Splitting contracts array into chunks
      console.log(
        `Splitting ${contracts.length} contracts into chunks of ${INSERT_CHUNK_SIZE} contracts`,
      );
      const contractChunks = chunkArray(contracts, INSERT_CHUNK_SIZE);
      console.log(`Number of chunks created: ${contractChunks.length}`);
      for (let i = 0; i < contractChunks.length; i++) {
        const chunk = contractChunks[i];
        const startTime = Date.now();
        await insertContractsTxHashBatch(chunk, databasePool);
        const elapsedTime = Date.now() - startTime;
        console.log(
          `Processed chunk ${i + 1}/${contractChunks.length} in ${elapsedTime} ms`,
        );
      }
      databasePool.end();
    } catch (e) {
      console.error("Error while storing contracts in the database", e);
      process.exit(3);
    }
  });

program
  .command("sync-single")
  .description("Sync a specific contract by chain ID, address, and match type")
  .argument(
    "<string>",
    "Sourcify instance url: e.g. https://sourcify.dev/server",
  )
  .argument(
    "<string>",
    "Path to repository v1 contracts folder (e.g. /Users/user/sourcify/repository/contracts)",
  )
  .option(
    "-c, --chainId <string>",
    "List of chains to sync separated by comma (e.g. 1,5,...)",
  )
  .option(
    "-a, --address <string>",
    "List of chains exceptions separated by comma (e.g. 1,5,...)",
  )
  .option(
    "-m, --matchType <type>",
    "Type of match: 'full_match' or 'partial_match'",
    "full_match", // Default is 'full'
  )
  .action(async (sourcifyInstance, repositoryV1Path, options) => {
    const databasePool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
    });

    const { chainId, address, matchType } = options;
    await processContract(
      sourcifyInstance,
      repositoryV1Path,
      databasePool,
      false,
      {
        chain_id: chainId,
        address,
        match_type: matchType,
      },
    )
      .then((res) => {
        if (res[0]) {
          console.log(`Successfully synced: ${[res[1]]}`);
        } else {
          console.error(`Failed to sync ${[res[1]]}`);
        }
      })
      .catch((e) => {
        console.error(e);
      });
    databasePool.end();
  });

program
  .command("sync")
  .description("Verifies contracts in the sourcify_sync table")
  .argument(
    "<string>",
    "Sourcify instance url: e.g. https://sourcify.dev/server",
  )
  .argument(
    "<string>",
    "Path to repository v1 contracts folder (e.g. /Users/user/sourcify/repository/contracts)",
  )
  .option(
    "-c, --chains [items]",
    "List of chains to sync separated by comma (e.g. 1,5,...)",
  )
  .option(
    "-ce, --chainsExceptions [items]",
    "List of chains exceptions separated by comma (e.g. 1,5,...)",
  )
  .option("-sf, --start-from [number]", "Start from a specific timestamp (ms)")
  .option("-l, --limit [number]", "Limit of concurrent verifications (ms)")
  .option(
    "-d, --deprecated [items]",
    "Pass --deprecated to sync deprecated networks",
  )
  .action(async (sourcifyInstance, repositoryV1Path, options) => {
    if (path.parse(repositoryV1Path).base !== "contracts") {
      console.error(
        "Passed repositoryV1 path is not correct: " + repositoryV1Path,
      );
      process.exit(4);
    }

    const databasePool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
    });

    // Get chains from database
    let chainsFromDB = [];
    const query = "SELECT DISTINCT chain_id FROM sourcify_sync";
    const chainsResult = await executeQueryWithRetry(databasePool, query);
    if (chainsResult.rowCount > 0) {
      chainsFromDB = chainsResult.rows.map(({ chain_id }) => chain_id);
    }

    console.log(
      `Chains to sync from sourciy_sync table: ${chainsFromDB.join(",")}`,
    );

    let chainsToSync = chainsFromDB;
    // Specify which chain to sync
    if (options.chains?.length > 0) {
      chainsToSync = chainsFromDB.filter((chain) =>
        options.chains.split(",").includes(`${chain}`),
      );
    }

    let deprecatedChains = [];
    if (options.deprecated?.length > 0) {
      deprecatedChains = chainsFromDB.filter((chain) =>
        options.deprecated?.split(",").includes(`${chain}`),
      );
      chainsToSync = chainsToSync.filter(
        (chain) => !options.deprecated.split(",").includes(`${chain}`),
      );
    }

    // Remove exceptions using --chainsException and 0
    chainsToSync = chainsToSync.filter(
      (chain) => !options.chainsExceptions?.split(",").includes(`${chain}`),
    );

    let monitoring = {
      totalSynced: 0,
      startedAt: Date.now(),
    };

    console.log(
      `Syncing chains: ${chainsToSync.join(",")} and deprecated chains: ${deprecatedChains.join(",")}`,
    );

    // Sync in parallel
    const syncPromises = chainsToSync.map((chainId) =>
      startSyncChain(
        sourcifyInstance,
        repositoryV1Path,
        chainId,
        JSON.parse(JSON.stringify(options)),
        databasePool,
        monitoring,
      ),
    );

    // Also sync deprecated in parallel
    const deprecatedSyncPromises = deprecatedChains.map((chainId) =>
      startSyncChain(
        sourcifyInstance,
        repositoryV1Path,
        chainId,
        JSON.parse(JSON.stringify(options)),
        databasePool,
        monitoring,
        true,
      ),
    );

    await Promise.all([...syncPromises, ...deprecatedSyncPromises]);

    databasePool.end();
  });

const startSyncChain = async (
  sourcifyInstance,
  repositoryV1Path,
  chainId,
  options,
  databasePool,
  monitoring,
  deprecated = false,
) => {
  let activePromises = 0;
  let maxLimit = options.limit ? options.limit : 1; // Maximum allowed parallel requests

  let processedContracts = 0;

  while (true) {
    while (activePromises >= maxLimit) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Fetch next contract
    let optionsSafe = JSON.parse(JSON.stringify(options));
    let nextContract = await fetchNextContract(
      databasePool,
      optionsSafe,
      chainId,
    );
    if (!nextContract && activePromises === 0) break; // Exit loop if no more contracts
    if (!nextContract) {
      continue;
    }
    options.startFrom = nextContract.id;

    // Process contract if within activePromises limit
    activePromises++;
    processContract(
      sourcifyInstance,
      repositoryV1Path,
      databasePool,
      deprecated,
      {
        address: nextContract.address.toString(),
        chain_id: nextContract.chain_id,
        match_type: nextContract.match_type,
      },
    )
      .then((res) => {
        if (res[0]) {
          monitoring.totalSynced++;
          logToFile(
            chainId,
            `Successfully synced: ${[res[1]]}. Currently running at ${(
              (1000 * monitoring.totalSynced) /
              (Date.now() - monitoring.startedAt)
            ).toFixed(2)} v/s`,
          );
        } else {
          logToFile(chainId, `Failed to sync: ${[res[1]]}`);
          console.error(`Failed to sync ${[res[1]]}`);
        }
        activePromises--;
        processedContracts++;
      })
      .catch((e) => {
        logToFile(chainId, e.message);
        console.error(e.message);
        activePromises--;
      });
  }
  logToFile(
    chainId,
    `Synced ${processedContracts} contracts for chainId ${chainId}`,
  );
};

// Utils functions
const processContract = async (
  sourcifyInstance,
  repositoryV1Path,
  databasePool,
  deprecated = false,
  contract,
) => {
  try {
    const address = contract.address;
    const chainId = contract.chain_id;
    const matchType = contract.match_type;

    const repoPath = path.join(
      repositoryV1Path,
      matchType,
      chainId,
      address,
      "/",
    );

    const files = {};
    for await (const entry of readdirp(repoPath)) {
      files[entry.path] = await readFile(entry.fullPath, "utf8");
    }

    const body = {
      address: address,
      chain: chainId,
      files,
    };

    const headers = {
      "Content-Type": "application/json",
    };
    if (process.env.BEARER_TOKEN) {
      headers.Authorization = `Bearer ${process.env.BEARER_TOKEN}`;
    }
    let url = `${sourcifyInstance}/verify`;
    if (deprecated) {
      url = `${sourcifyInstance}/verify-deprecated`;
      switch (matchType) {
        case "full_match":
          body.match = "perfect";
          break;
        case "partial_match":
          body.match = "partial";
          break;
        default:
          throw new Error("Cannot infer match type");
      }
    }
    const request = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });

    if (request.status === 200) {
      const response = await request.json();
      if (response.result[0].status !== null) {
        await executeQueryWithRetry(
          databasePool,
          `
          UPDATE sourcify_sync
          SET 
            synced = true
          WHERE 1=1
            AND chain_id = $1
            AND address = $2
            AND match_type = $3   
          `,
          [contract.chain_id, contract.address, contract.match_type],
        );
      } else {
        throw new Error([
          false,
          `${[
            contract.chain_id,
            contract.address,
            contract.match_type,
          ]} with error: ${response.result[0].message}`,
        ]);
      }
      return [true, [contract.chain_id, contract.address, contract.match_type]];
    } else {
      throw new Error(
        `Failed to sync: ${[
          contract.chain_id,
          contract.address,
          contract.match_type,
        ]} with error: ${await request.text()}`,
      );
    }
  } catch (e) {
    throw new Error(
      `Failed to sync ${[
        contract.chain_id,
        contract.address,
        contract.match_type,
      ]} with error: ${e}`,
    );
  }
};

function logToFile(chainId, message) {
  const logDirectory = path.join(__dirname, "chain-sync-logs");
  const logFilename = `${chainId}.log`;
  const logPath = path.join(logDirectory, logFilename);
  const timestampedMessage = `${new Date().toISOString()} - ${message}`;

  // Ensure the log directory exists
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  // Append message to the log file
  fs.appendFileSync(logPath, timestampedMessage + "\n");

  // Also log to console
  console.log(timestampedMessage);
}

const fetchNextContract = async (databasePool, options, chainId, limit = 1) => {
  try {
    const query = `
      SELECT
        *
      FROM sourcify_sync
      WHERE 1=1
        AND id > $1
        AND chain_id = $2
        AND synced = false
      ORDER BY id ASC
      LIMIT ${limit}
    `;
    const contractResult = await executeQueryWithRetry(databasePool, query, [
      options.startFrom ? options.startFrom : 0,
      chainId,
    ]);
    if (contractResult.rowCount > 0) {
      return contractResult.rows[0];
    } else {
      return undefined;
    }
  } catch (e) {
    console.error("Error while reading contracts from the database");
    console.error(e);
    process.exit(3);
  }
};

/**
 * Chunk an array into smaller arrays
 * e.g. [1, 2, 3, 4, 5, 6] => [[1, 2], [3, 4], [5, 6]]
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

const insertContractsBatch = async (contractsChunk, pool) => {
  const query = `
    INSERT INTO sourcify_sync (chain_id, address, match_type, created_at)
    VALUES ${contractsChunk.map((_, index) => `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`).join(", ")}
    ON CONFLICT (chain_id, address) DO NOTHING
  `;

  const params = contractsChunk.flatMap((contract) => [
    contract.chainId,
    contract.address,
    contract.matchType,
    contract.timestamp,
  ]);

  try {
    await executeQueryWithRetry(pool, query, params);
    console.log(
      `Batch inserted ${contractsChunk.length} contracts successfully.`,
    );
  } catch (e) {
    console.error("Failed to batch insert contracts", e);
  }
};

export function bytesFromString(str) {
  if (str === undefined) {
    return undefined;
  }
  let stringWithout0x;
  if (str.substring(0, 2) === "0x") {
    stringWithout0x = str.substring(2);
  } else {
    stringWithout0x = str;
  }
  return Buffer.from(stringWithout0x, "hex");
}

const insertContractsTxHashBatch = async (contractsChunk, pool) => {
  const query = `
    INSERT INTO sourcify_transaction_hash (chain_id, address, transaction_hash)
    VALUES ${contractsChunk.map((_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`).join(", ")}
    ON CONFLICT (chain_id, address) DO NOTHING
  `;

  const params = contractsChunk.flatMap((contract) => [
    contract.chainId,
    bytesFromString(contract.address),
    bytesFromString(contract.creatorTxHash),
  ]);

  try {
    await executeQueryWithRetry(pool, query, params);
    console.log(
      `Batch inserted ${contractsChunk.length} contracts successfully.`,
    );
  } catch (e) {
    console.error("Failed to batch insert contracts", e);
  }
};

function isNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

const executeQueryWithRetry = async (
  databasePool,
  query,
  params,
  maxRetries = 5,
  delay = 5000,
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await databasePool.query(query, params);
      return result;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        console.error(
          `Database connection error. Retrying attempt ${attempt + 1}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached. Could not connect to the database.");
};

program.parse(process.argv);
