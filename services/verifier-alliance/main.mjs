import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

const { Client } = pg;

// Load current verified contract counter from file
const COUNTER_FILE = path.join(__dirname, "CURRENT_VERIFIED_CONTRACT");
let CURRENT_VERIFIED_CONTRACT = 1;
if (fs.existsSync(COUNTER_FILE)) {
  CURRENT_VERIFIED_CONTRACT = parseInt(
    fs.readFileSync(COUNTER_FILE, "utf8"),
    10
  );
}

const N = 200; // Number of contracts to process at a time

const SOURCE_DB_CONFIG = {
  host: process.env.SOURCIFY_HOST,
  database: process.env.SOURCIFY_DB,
  user: process.env.SOURCIFY_USER,
  password: process.env.SOURCIFY_PASSWORD,
  port: process.env.SOURCIFY_PORT,
};

const TARGET_DB_CONFIG = {
  host: process.env.VERA_HOST,
  database: process.env.VERA_DB,
  user: process.env.VERA_USER,
  password: process.env.VERA_PASSWORD,
  port: process.env.VERA_PORT,
};

const sourceClient = new Client(SOURCE_DB_CONFIG);
const targetClient = new Client(TARGET_DB_CONFIG);

async function upsertAndGetId(
  query,
  conflictQuery,
  insertValues,
  selectValues,
  client
) {
  await client.query(query, insertValues);
  const { rows } = await client.query(conflictQuery, selectValues);
  return rows[0].id;
}

(async () => {
  try {
    await sourceClient.connect();
    await targetClient.connect();

    let verifiedContractCount = 1;

    while (verifiedContractCount > 0) {
      const { rows: verifiedContracts, rowCount } = await sourceClient.query(
        `
              SELECT * FROM verified_contracts
              WHERE id >= $1
                AND compilation_id in (select id from compiled_contracts where creation_code_hash is not null)
              ORDER BY id ASC
              LIMIT $2
          `,
        [CURRENT_VERIFIED_CONTRACT, N]
      );

      verifiedContractCount = rowCount;

      for (const contract of verifiedContracts) {
        const {
          id: verifiedContractId,
          deployment_id,
          compilation_id,
        } = contract;

        // Update the CURRENT_VERIFIED_CONTRACT counter
        CURRENT_VERIFIED_CONTRACT = verifiedContractId;
        fs.writeFileSync(
          COUNTER_FILE,
          CURRENT_VERIFIED_CONTRACT.toString(),
          "utf8"
        );

        // Get all information for verified_contracts
        const verifiedContract = contract;

        // Get all FK information
        const {
          rows: [deployment],
        } = await sourceClient.query(
          "SELECT * FROM contract_deployments WHERE id = $1",
          [deployment_id]
        );
        const {
          rows: [compilation],
        } = await sourceClient.query(
          "SELECT * FROM compiled_contracts WHERE id = $1",
          [compilation_id]
        );
        if (compilation.creation_code_hash === null) {
          continue;
        }
        const {
          rows: [creationCode],
        } = await sourceClient.query(
          "SELECT * FROM code WHERE code_hash = $1",
          [compilation.creation_code_hash]
        );
        const {
          rows: [runtimeCode],
        } = await sourceClient.query(
          "SELECT * FROM code WHERE code_hash = $1",
          [compilation.runtime_code_hash]
        );

        // Insert dependencies into target DB and handle conflicts
        await targetClient.query(
          `
                  INSERT INTO code (code_hash, code)
                  VALUES ($1, $2)
                  ON CONFLICT (code_hash) DO NOTHING
              `,
          [creationCode.code_hash, creationCode.code]
        );

        await targetClient.query(
          `
                  INSERT INTO code (code_hash, code)
                  VALUES ($1, $2)
                  ON CONFLICT (code_hash) DO NOTHING
              `,
          [runtimeCode.code_hash, runtimeCode.code]
        );

        const newContractIdValues = [
          compilation.creation_code_hash,
          compilation.runtime_code_hash,
        ];
        const newContractId = await upsertAndGetId(
          `
                  INSERT INTO contracts (creation_code_hash, runtime_code_hash)
                  VALUES ($1, $2)
                  ON CONFLICT (creation_code_hash, runtime_code_hash) DO NOTHING
              `,
          `
                  SELECT id FROM contracts WHERE creation_code_hash = $1 AND runtime_code_hash = $2
              `,
          newContractIdValues,
          newContractIdValues,
          targetClient
        );

        const newDeploymentIdValues = [
          deployment.chain_id,
          deployment.address,
          deployment.transaction_hash,
          deployment.block_number,
          deployment.transaction_index,
          deployment.deployer,
          newContractId,
        ];
        const newDeploymentId = await upsertAndGetId(
          `
                  INSERT INTO contract_deployments (chain_id, address, transaction_hash, block_number, transaction_index, deployer, contract_id)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                  ON CONFLICT (chain_id, address, transaction_hash) DO NOTHING
              `,
          `
                  SELECT id FROM contract_deployments WHERE chain_id = $1 AND address = $2 AND transaction_hash = $3
              `,
          newDeploymentIdValues,
          newDeploymentIdValues.slice(0, 3),
          targetClient
        );

        const newCompilationIdValues = [
          compilation.compiler,
          compilation.language,
          compilation.creation_code_hash,
          compilation.runtime_code_hash,
          compilation.version,
          compilation.name,
          compilation.fully_qualified_name,
          compilation.sources,
          compilation.compiler_settings,
          compilation.compilation_artifacts,
          compilation.creation_code_artifacts,
          compilation.runtime_code_artifacts,
        ];
        const newCompilationId = await upsertAndGetId(
          `
                  INSERT INTO compiled_contracts (
                      compiler, language, creation_code_hash, runtime_code_hash, version, name, fully_qualified_name, sources, compiler_settings,
                      compilation_artifacts, creation_code_artifacts, runtime_code_artifacts)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  ON CONFLICT (compiler, language, creation_code_hash, runtime_code_hash) DO NOTHING
              `,
          `
                  SELECT id FROM compiled_contracts WHERE compiler = $1 AND language = $2 AND creation_code_hash = $3 AND runtime_code_hash = $4
              `,
          newCompilationIdValues,
          newCompilationIdValues.slice(0, 4),
          targetClient
        );

        await targetClient.query(
          `
                  INSERT INTO verified_contracts (
                      created_at, updated_at, created_by, updated_by, deployment_id, compilation_id, 
                      creation_match, creation_values, creation_transformations, 
                      runtime_match, runtime_values, runtime_transformations)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  ON CONFLICT (compilation_id, deployment_id) DO NOTHING
              `,
          [
            verifiedContract.created_at,
            verifiedContract.updated_at,
            verifiedContract.created_by,
            verifiedContract.updated_by,
            newDeploymentId,
            newCompilationId,
            verifiedContract.creation_match,
            verifiedContract.creation_values,
            JSON.stringify(verifiedContract.creation_transformations),
            verifiedContract.runtime_match,
            verifiedContract.runtime_values,
            JSON.stringify(verifiedContract.runtime_transformations),
          ]
        );
      }
    }
    console.log("Contracts transferred successfully.");
  } catch (error) {
    console.error("Error transferring contracts:", error);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
})();
