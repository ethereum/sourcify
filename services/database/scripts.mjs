import { program } from "commander";
import dotenv from "dotenv";
import readdirp from "readdirp";
import pg from "pg";
import path from "path";
import fs from "fs";

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
    "Create a .env file containing all the needed environment variables for the database connection"
  );
  process.exit(2);
}

program
  .command("import-repo")
  .description("Import repository_v1 to Sourcify's sourcify_sync table")
  .argument(
    "<string>",
    "Path to repository v1 contracts folder (e.g. /Users/user/sourcify/repository/contracts)"
  )
  .option("-sf, --start-from [number]", "Start from a specific timestamp (ms)")
  .option("-un, --until [number]", "Stop at a specific timestamp (ms)")
  .action(async (repositoryV1Path, options) => {
    if (path.parse(repositoryV1Path).base !== "contracts") {
      console.error(
        "Passed repositoryV1 path is not correct: " + repositoryV1Path
      );
      process.exit(4);
    }

    let contractsSorted;

    // 1. Read contracts from repository
    try {
      let contracts = [];

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
        }
      }

      contractsSorted = contracts.sort(
        (o1, o2) => o1.timestamp.getTime() - o2.timestamp.getTime()
      );

      if (options.startFrom) {
        contractsSorted = contractsSorted.filter(
          (obj) => obj.timestamp.getTime() > options.startFrom
        );
      }

      if (options.until) {
        contractsSorted = contractsSorted.filter(
          (obj) => obj.timestamp.getTime() < options.until
        );
      }
    } catch (e) {
      console.error(
        "Error while reading and formatting files from the repository"
      );
      console.error(e);
      process.exit(3);
    }

    // 2. Insert contracts to sourcify_sync table
    try {
      const databasePool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        max: 5,
      });

      for (const contract of contractsSorted) {
        await executeQueryWithRetry(
          databasePool,
          `INSERT INTO sourcify_sync (chain_id, address, match_type, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (chain_id, address) DO NOTHING`,
          [
            contract.chainId,
            contract.address,
            contract.matchType,
            contract.timestamp,
          ]
        );
        console.log(
          `Contract inserted to the sourcify_sync table: \n ${[
            contract.chainId,
            contract.address,
            contract.matchType,
            contract.timestamp.getTime(),
          ]}`
        );
      }

      console.log(
        "successfuly imported from '" +
          repositoryV1Path +
          "' " +
          contractsSorted.length +
          " contracts."
      );
      databasePool.end();
    } catch (e) {
      console.error("Error while storing contract in the database");
      console.error(e);
      process.exit(3);
    }
  });

program
  .command("sync")
  .description("Verifies contracts in the sourcify_sync table")
  .argument(
    "<string>",
    "Sourcify instance url: e.g. https://sourcify.dev/server"
  )
  .argument(
    "<string>",
    "Path to repository v1 contracts folder (e.g. /Users/user/sourcify/repository/contracts)"
  )
  .option(
    "-c, --chains [items]",
    "List of chains to sync separated by comma (e.g. 1,5,...)"
  )
  .option(
    "-ce, --chainsExceptions [items]",
    "List of chains exceptions separated by comma (e.g. 1,5,...)"
  )
  .option("-sf, --start-from [number]", "Start from a specific timestamp (ms)")
  .option("-l, --limit [number]", "Limit of concurrent verifications (ms)")
  .action(async (sourcifyInstance, repositoryV1Path, options) => {
    if (path.parse(repositoryV1Path).base !== "contracts") {
      console.error(
        "Passed repositoryV1 path is not correct: " + repositoryV1Path
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
    let chains = [];
    const query = "SELECT DISTINCT chain_id FROM sourcify_sync";
    const chainsResult = await executeQueryWithRetry(databasePool, query);
    if (chainsResult.rowCount > 0) {
      chains = chainsResult.rows.map(({ chain_id }) => chain_id);
    }

    // Specify which chain to sync
    if (options.chains) {
      chains = chains.filter((chain) =>
        options.chains.split(",").includes(`${chain}`)
      );
    }

    // Remove exceptions using --chainsException and 0
    if (options.chainsExceptions) {
      chains = chains.filter(
        (chain) => !options.chainsExceptions.split(",").includes(`${chain}`)
      );
    }

    let monitoring = {
      totalSynced: 0,
      startedAt: Date.now(),
    };
    // For each chain start a parallel process
    await Promise.all(
      chains.map((chainId) =>
        startSyncChain(
          sourcifyInstance,
          repositoryV1Path,
          chainId,
          JSON.parse(JSON.stringify(options)),
          databasePool,
          monitoring
        )
      )
    );

    databasePool.end();
  });

const startSyncChain = async (
  sourcifyInstance,
  repositoryV1Path,
  chainId,
  options,
  databasePool,
  monitoring
) => {
  let activePromises = 0;
  let limit = options.limit ? options.limit : 1;

  let processedContracts = 0;
  while (true) {
    while (activePromises >= limit) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Helps to reduce the rpc hit limit error
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Fetch next contract
    let optionsSafe = JSON.parse(JSON.stringify(options));
    let nextContract = await fetchNextContract(
      databasePool,
      optionsSafe,
      chainId
    );
    if (!nextContract && activePromises === 0) break; // Exit loop if no more contracts
    if (!nextContract) {
      continue;
    }
    options.startFrom = nextContract.id;

    // Process contract if within activePromises limit

    activePromises++;
    processContract(sourcifyInstance, repositoryV1Path, databasePool, {
      address: nextContract.address.toString(),
      chain_id: nextContract.chain_id,
      match_type: nextContract.match_type,
    })
      .then((res) => {
        if (res[0]) {
          monitoring.totalSynced++;
          console.log(
            `Successfully sync: ${[res[1]]}. Currently running at ${(
              (1000 * monitoring.totalSynced) /
              (Date.now() - monitoring.startedAt)
            ).toFixed(2)} v/s`
          );
        } else {
          console.error(`Failed to sync ${[res[1]]}`);
        }
        activePromises--;
        processedContracts++;
      })
      .catch((e) => {
        console.error(e);
      });
  }
  console.log(`Synced ${processedContracts} contracts for chainId ${chainId}`);
};

// Utils functions
const processContract = async (
  sourcifyInstance,
  repositoryV1Path,
  databasePool,
  contract
) => {
  return new Promise(async (resolve) => {
    try {
      const address = contract.address;
      const chainId = contract.chain_id;
      const matchType = contract.match_type;

      const repoPath = path.join(
        repositoryV1Path,
        matchType,
        chainId,
        address,
        "/"
      );

      const files = {};
      for await (const entry of readdirp(repoPath, {
        fileFilter: ["*.sol", "metadata.json"],
      })) {
        files[entry.path] = await readFile(entry.fullPath, "utf8");
      }

      const body = {
        address: address,
        chain: chainId,
        files,
      };

      const request = await fetch(`${sourcifyInstance}/verify`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
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
            [contract.chain_id, contract.address, contract.match_type]
          );
        }
        resolve([
          true,
          [contract.chain_id, contract.address, contract.match_type],
        ]);
      } else {
        resolve([
          false,
          `${[
            contract.chain_id,
            contract.address,
            contract.match_type,
          ]} with error: ${await request.text()}`,
        ]);
      }
    } catch (e) {
      resolve([
        false,
        `${[
          contract.chain_id,
          contract.address,
          contract.match_type,
        ]} with error: ${e}`,
      ]);
    }
  });
};

const fetchNextContract = async (databasePool, options, chainId) => {
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
      LIMIT 1
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

function isNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

const executeQueryWithRetry = async (
  databasePool,
  query,
  params,
  maxRetries = 5,
  delay = 5000
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await databasePool.query(query, params);
      return result;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        console.error(
          `Database connection error. Retrying attempt ${attempt + 1}...`
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
