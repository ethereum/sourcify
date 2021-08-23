#!/usr/bin/env node

/**
 * Part of E2E Monitor test run for staging and master builds
 * Script queries the repository to discover whether a contract
 * published to Rinkeby in CI has been picked up and saved by the
 * monitor.
 */

require("dotenv").config({ path: "environments/.env" });
const assert = require('assert');
const fetch = require('node-fetch');
const util = require('util');
const log = console.log;

const artifact = require('../metacoin-source-verify/build/contracts/MetaCoin.json')
const chainIDs = process.argv.slice(2).map(id => parseInt(id));
if (chainIDs.length === 0) {
  log("No chainIDs specified");
  process.exit(1);
}

log(`ChainIDs: ${chainIDs.join(", ")}`)

async function main(){
  const failedChains = [];
  for (const chainID of chainIDs) {
    const address = artifact.networks[chainID].address;
    const url = `${process.env.REPOSITORY_URL}/contracts/full_match/${chainID}/${address}/metadata.json`;

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
      log(`Metadata not found in repository for chain ${chainID}...`);
      failedChains.push(chainID);
      continue;
    }

    assert(metadata.compiler.version !== undefined);
    assert(metadata.language === 'Solidity');

    log();
    log(`>>>>>>>>`);
    log(`Metadata`);
    log(`>>>>>>>>`);
    log();

    log(util.inspect(metadata));
  }

  if (failedChains.length) {
    throw new Error(`Metadata not found for chains: ${failedChains.join(", ")}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log(err);
    process.exit(2);
  })
