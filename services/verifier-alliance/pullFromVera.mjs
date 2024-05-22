import pg from "pg";
import createSubscriber from "pg-listen";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const { Client } = pg;

const veraClient = new Client({
  host: process.env.VERA_HOST,
  database: process.env.VERA_DB,
  user: process.env.VERA_USER,
  password: process.env.VERA_PASSWORD,
  port: process.env.VERA_PORT,
});

const subscriber = createSubscriber({
  host: process.env.VERA_HOST,
  port: parseInt(process.env.VERA_PORT) || 5432,
  database: process.env.VERA_DB,
  user: process.env.VERA_USER,
  password: process.env.VERA_PASSWORD,
});

async function main() {
  await veraClient.connect();

  subscriber.notifications.on("new_verified_contract", async (payload) => {
    console.log("Received notification in 'new_verified_contract':", payload);

    // Skip verified_contracts pushed by sourcify
    if (payload.created_by === "sourcify") {
      return;
    }
    // Get all FK information
    const {
      rows: [deployment],
    } = await veraClient.query(
      "SELECT * FROM contract_deployments WHERE id = $1",
      [payload.deployment_id]
    );
    const {
      rows: [compilation],
    } = await veraClient.query(
      "SELECT * FROM compiled_contracts WHERE id = $1",
      [payload.compilation_id]
    );

    // For some reason inside `compilation.compiler_settings` there is a compilationTarget parameter that is not supported by solc
    const settings = compilation.compiler_settings;
    delete settings.compilationTarget;

    const settingsJson = JSON.stringify({
      language: "Solidity",
      sources: Object.keys(compilation.sources).reduce((obj, current) => {
        obj[current] = {
          content: compilation.sources[current],
        };
        return obj;
      }, {}),
      settings: compilation.compiler_settings,
    });

    console.log(
      "0x" + deployment.address.toString("hex"),
      deployment.chain_id,
      settingsJson
    );
    try {
      const res = await fetch(
        `${process.env.SOURCIFY_SERVER_HOST}/verify/solc-json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            compilerVersion: compilation.version,
            contractName: compilation.name,
            address: "0x" + deployment.address.toString("hex"),
            chainId: deployment.chain_id,
            files: {
              "settings.json": settingsJson,
            },
          }),
        }
      );

      console.log(await res.json());
    } catch (e) {
      console.error(e);
    }
  });

  subscriber.connect();
  console.log("Started listening for VerA verified_contracts...");
  subscriber.listenTo("new_verified_contract");
}

main();
