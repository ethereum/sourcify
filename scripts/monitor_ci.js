#!/usr/bin/env node

/**
 * Part of E2E Monitor test run for staging and master builds
 * Script queries the repository to discover whether a contract
 * published to Goerli in CI has been picked up and saved by the
 * monitor.
 */

const assert = require('assert');
const fetch = require('node-fetch');
const util = require('util');
const log = console.log;

let root;
const circleBranch = process.env.CIRCLE_BRANCH;

if (circleBranch === 'master') {
  root = 'https://repo.sourcify.dev/';

} else if (circleBranch === 'staging') {
  root = 'https://repo.staging.sourcify.dev/';

} else {
  log('Unknown circle branch:', circleBranch);
  process.exit(1);
}

const artifact = require('../metacoin-source-verify/build/contracts/MetaCoin.json')
const address = artifact.networks['5'].address;

async function main(){
  const url = `${root}contracts/full_match/5/${address}/metadata.json`;

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
    throw new Error('Metadata not found in repository...');
  }

  assert(metadata.compiler.version !== undefined);
  assert(metadata.language === 'Solidity');

  log();
  log(`>>>>>>>>`);
  log(`Metadata`);
  log(`>>>>>>>>`);
  log();

  console.log(util.inspect(metadata));
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  })
