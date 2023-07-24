#!/usr/bin/env node

/**
 * Part of E2E Monitor test run for staging and master builds
 * Script queries the repository to discover whether a contract
 * published to {chainID} in CI has been picked up and saved by the
 * monitor.
 */

require("dotenv").config({ path: "environments/.env" });
const assert = require("assert");
const fetch = require("node-fetch");
const util = require("util");
const log = console.log;

const chainID = parseInt(process.argv[2]);
const chainName = process.argv[3];
if (!chainID || !chainName) {
  log("Expected arguments: <chainID> <chainName>");
  process.exit(1);
}

const artifact = require("../metacoin-source-verify/MetaCoin.json");
const address = artifact.networks[chainID].address;

async function main() {
  const url = `${process.env.REPOSITORY_SERVER_URL}/contracts/full_match/${chainID}/${address}/metadata.json`;

  log();
  log(`>>>>>>>>>>>>>>>>>>>>`);
  log(`Fetching: ${url}    `);
  log(`>>>>>>>>>>>>>>>>>>>>`);
  log();

  const res = await fetch(url);
  const text = await res.text();

  let metadata;
  try {
    metadata = JSON.parse(text);
  } catch (err) {
    throw new Error("Metadata not found in repository...");
  }

  assert(metadata.compiler.version !== undefined);
  assert(metadata.language === "Solidity");

  log();
  log(`>>>>>>>>`);
  log(`Metadata`);
  log(`>>>>>>>>`);
  log();

  log(util.inspect(metadata));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log(err);
    process.exit(1);
  });
