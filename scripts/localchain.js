#!/usr/bin/env node

/**
 * Launches a testrpc and deploys some of the test sources to it.
 * When the enviroment variable TESTING=true, the injector automatically
 * queries this local network, allowing you to experiment with submitting
 * different combinations of sources and metadata via the ui.
 */
const ganache = require('ganache-cli');
const pify = require('pify');
const Web3 = require('web3');

const Simple = require('./../test/sources/pass/simple');
const SimpleWithImport = require('./../test/sources/pass/simpleWithImport')

let server;
const log = console.log;
const port = process.env.LOCALCHAIN_PORT;

async function main(){

  // Launch server
  log(`Launching server on port ${port}...`);
  log();

  server = ganache.server();
  await pify(server.listen)(port);

  const web3 = new Web3(`http://localhost:${port}`);
  const accounts = await web3.eth.getAccounts();

  // Deploy contracts

  // sources (1):  contracts/Simple.sol,
  // metadata: metadata/simple.meta.json
  const simple = new web3.eth.Contract(
    Simple.compilerOutput.abi,
    {
      gasPrice: '1',
      gas: 4000000,
      data: Simple.compilerOutput.evm.bytecode.object
    }
  );

  // sources (2):  contracts/SimpleWithImport.sol, contracts/Import.sol
  // metadata: metadata/simpleWithImport.meta.json
  const simpleWithImport = new web3.eth.Contract(
    SimpleWithImport.compilerOutput.abi,
    {
      gasPrice: '1',
      gas: 4000000,
      data: SimpleWithImport.compilerOutput.evm.bytecode.object
    }
  );

  log(`==========================================`);
  log(`Deployed Contracts  |  Addresses          `);
  log(`==========================================`);
  log();

  const s = await simple.deploy().send({from: accounts[0]});
  log(`Simple.sol:           ${s.options.address}`);

  const swi = await simpleWithImport.deploy().send({from: accounts[0]});
  log(`SimpleWithImport.sol: ${swi.options.address}`);

  log();
  log(`====================`);
  log(`Press ctrl-c to exit`);
  log(`====================`);
}

// Main
main()
  .then()
  .catch(err => {
    console.log(err);
    process.exit(1);
  })
