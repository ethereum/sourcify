import { program } from "commander";
import dotenv from "dotenv";
import readdirp from "readdirp";
import pg from "pg";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";

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

        if (matchType === "full_match" || matchType === "partial_match") {
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
        await databasePool.query(
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
            contract.timestamp,
          ]}`
        );
      }
    } catch (e) {
      console.error("Error while storing contract in the database");
      console.error(e);
      process.exit(3);
    }

    console.log("successfuly imported contracts from" + repositoryV1Path);
    databasePool.end();
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
    "List of chains separated by comma (e.g. 1,5,...)"
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

    let activePromises = 0;
    let limit = options.limit ? options.limit : 1;

    let processedContracts = 0;
    while (true) {
      // Fetch next contract
      let optionsSafe = JSON.parse(JSON.stringify(options));
      let nextContract = await fetchNextContract(databasePool, optionsSafe);
      if (!nextContract && activePromises === 0) break; // Exit loop if no more contracts
      if (!nextContract) {
        // Wait until all contracts in the queue are processed
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      options.startFrom = nextContract.id;

      // Process contract if within activePromises limit
      if (activePromises < limit) {
        activePromises++;
        processContract(
          sourcifyInstance,
          repositoryV1Path,
          databasePool,
          nextContract
        )
          .then((res) => {
            if (res[0]) {
              console.log(`Successfully sync: ${[res[1]]}`);
            } else {
              console.error(`Failed to sync ${[res[1]]}`);
            }
            activePromises--;
            processedContracts++;
          })
          .catch((e) => {
            console.error(e);
          });
      } else {
        // Wait for an active promise to complete
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    console.log(`Synced ${processedContracts} contracts`);
    databasePool.end();
  });

// Utils functions
const processContract = async (
  sourcifyInstance,
  repositoryV1Path,
  databasePool,
  contract
) => {
  return new Promise(async (resolve) => {
    try {
      const address = contract.address.toString();
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
          await databasePool.query(
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

const fetchNextContract = async (databasePool, options) => {
  const chains = options.chains?.split(",") || [];
  try {
    const query = `
      SELECT
        *
      FROM sourcify_sync
      WHERE 1=1
        AND id > $1
        ${
          // This is needed because the `pg` package needs $n parameters in the queries where n is the index of the second array
          chains?.length > 0
            ? "AND (1=0 " +
              chains.map((_, i) => "OR chain_id = $" + (i + 2)).join(" ") +
              ")"
            : ""
        }
        AND synced = false
      ORDER BY chain_id ASC, id ASC
      LIMIT 1
    `;
    const queryParameter = [
      options.startFrom ? options.startFrom : 0,
      ...chains,
    ];
    const contractResult = await databasePool.query(query, queryParameter);
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

program.parse(process.argv);
