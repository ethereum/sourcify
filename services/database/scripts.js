const { program } = require("commander");
const dotenv = require("dotenv");
const readdirp = require("readdirp");
const { Pool } = require("pg");
const path = require("path");
const { readFile } = require("fs/promises");
const fetch = require("node-fetch");
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
  .argument("<string>", "Path to repository v1")
  .option("-sf, --start-from [number]", "Start from a specific timestamp")
  .action(async (repositoryV1Path, options) => {
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
  .argument("<string>", "Sourcify instance")
  .argument("<string>", "Path to repository v1")
  .option("-c, --chains [items]", "List of chains")
  .option("-sf, --start-from [number]", "Start from a specific timestamp")
  .option("-l, --limit [number]", "Limit of concurrent verifications")
  .action(async (sourcifyInstance, repositoryV1Path, options) => {
    const databasePool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 5,
    });

    /**
     * We are going to send batch of /verify requests to the database (the amount is configurable with -l).
     * Each request within a batch will be sent simultaneously to the server, we will wait the response
     * from every request from the batch before continuing.
     */

    let limit = options.limit ? options.limit : 1;
    let page = 0;

    let contractResultLength = limit;
    while (contractResultLength !== 0) {
      let contractsResult;

      // 1. Read from the database the first n(`limit`) contract
      try {
        contractsResult = await databasePool.query(
          `
            SELECT
              *
            FROM sourcify_sync
            WHERE 1=1
              AND chain_id IN ($1)
              AND created_at > $2
              AND synced = false
            ORDER BY chain_id ASC, created_at ASC
            LIMIT $3 OFFSET $4
          `,
          [
            options.chains,
            options.startFrom
              ? new Date(options.startFrom)
              : "1970-01-01 00:00:00.0000 +0000",
            limit,
            page * limit,
          ]
        );
      } catch (e) {
        console.error("Error while reading contracts from the database");
        console.error(e);
        process.exit(3);
      }

      // 2. For each group of retrieved contract prepare and send the /verify requests in a batch `promises`
      let promises = [];
      for (let contract of contractsResult.rows) {
        promises.push(
          new Promise(async (resolve, reject) => {
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

              const request = await fetch(
                `${sourcifyInstance}/verify`,
                sourcifyInstance``,
                {
                  method: "POST",
                  body: JSON.stringify(body),
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

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
                resolve([true]);
              } else {
                resolve([
                  false,
                  `Crashed at ${[
                    contract.chain_id,
                    contract.address,
                    contract.match_type,
                  ]} with error: \n${await request.text()}`,
                ]);
              }
            } catch (e) {
              resolve([
                false,
                `Crashed at ${[
                  contract.chain_id,
                  contract.address,
                  contract.match_type,
                ]} with error:`,
              ]);
            }
          })
        );
      }

      // 3. Wait for the result of the first batch
      try {
        const results = await Promise.all(promises);
        results.forEach((res) => {
          /**
           * TODO: we probably don't want to block everything for each failing contract, we'll be able to
           * identify the failing contracts because in the table they still have `synced` set to false.
           */
          //
          // 3.1 If one of the contract in the batch returns an error block the process and log
          if (!res[0]) {
            console.log(results);
            console.error(res[1]);
            process.exit(1);
          }
        });
      } catch (e) {
        console.error("Unexpected error");
        process.exit(1);
      }
      // 4. Set pagination variables to prepare the next batch of contracts
      contractResultLength = contractsResult.rowCount;
      page++;
    }
  });

program.parse(process.argv);
