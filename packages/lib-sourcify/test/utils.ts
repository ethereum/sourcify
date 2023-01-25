/* eslint-disable @typescript-eslint/no-var-requires */
// Functions here assume a folder structure like this:
// - contractFolderPath
//   - artifact.json
//   - metadata.json
//   - sources
//     - source1.sol
//     - source2.sol

import path from 'path';
import Web3 from 'web3';
import fs from 'fs';
import { ContextVariables, Match, SourcifyChain, verifyDeployed } from '../src';
import { checkFiles } from '../src';
import { expect } from 'chai';

/**
 *  Function to deploy contracts from provider unlocked accounts
 */
// TODO: ABI type definition
export async function deployFromAbiAndBytecode(
  web3: Web3,
  contractFolderPath: string,
  from: string,
  args?: any[]
) {
  const artifact = require(path.join(contractFolderPath, 'artifact.json'));
  // Deploy contract
  const contract = new web3.eth.Contract(artifact.abi);
  const deployment = contract.deploy({
    data: artifact.bytecode,
    arguments: args || [],
  });
  const gas = await deployment.estimateGas({ from });
  const contractResponse = await deployment.send({
    from,
    gas,
  });
  return contractResponse.options.address;
}

/**
 * Checks the contract from metadata and source files under contractFolderPath and
 * verifies it on sourcifyChain at address.
 * The metadata must be at contractFolderPath/metadata.json and the sources must be under contractFolderPath/sources.
 */
export const checkAndVerifyDeployed = async (
  contractFolderPath: string,
  sourcifyChain: SourcifyChain,
  address: string,
  contextVariables?: ContextVariables,
  creatorTxHash?: string
) => {
  const metadataPath = path.join(contractFolderPath, 'metadata.json');
  const metadataBuffer = fs.readFileSync(metadataPath);
  const metadataPathBuffer = { path: metadataPath, buffer: metadataBuffer };

  const sourceFilePaths = fs.readdirSync(
    path.join(contractFolderPath, 'sources')
  );
  const sourcePathBuffers = sourceFilePaths.map((sourceFilePath) => {
    const sourceBuffer = fs.readFileSync(
      path.join(contractFolderPath, 'sources', sourceFilePath)
    );
    return { path: sourceFilePath, buffer: sourceBuffer };
  });
  const checkedContracts = await checkFiles([
    metadataPathBuffer,
    ...sourcePathBuffers,
  ]);
  const match = await verifyDeployed(
    checkedContracts[0],
    sourcifyChain,
    address,
    contextVariables,
    creatorTxHash
  );
  return match;
};

/**
 * Combines both deploying and verifying a contract in a single function.
 * Returns the deployed address for assertions on Match.address
 */
export const deployCheckAndVerify = async (
  contractFolderPath: string,
  sourcifyChain: SourcifyChain,
  web3provider: Web3,
  from: string,
  args?: any[],
  contextVariables?: ContextVariables,
  creatorTxHash?: string
) => {
  const deployedAddress = await deployFromAbiAndBytecode(
    web3provider,
    contractFolderPath,
    from,
    args
  );
  const match = await checkAndVerifyDeployed(
    contractFolderPath,
    sourcifyChain,
    deployedAddress,
    contextVariables,
    creatorTxHash
  );
  return { match, deployedAddress };
};

// Sends a tx that changes the state
export async function callContractMethodWithTx(
  web3: Web3,
  contractFolderPath: string,
  contractAddress: string,
  methodName: string,
  from: string,
  args: any[]
) {
  const artifact = require(path.join(contractFolderPath, 'artifact.json'));
  const contract = new web3.eth.Contract(artifact.abi, contractAddress);
  const method = contract.methods[methodName](...args);
  const gas = await method.estimateGas({ from });

  const txReceipt = await method.send({
    from,
    gas,
  });

  return txReceipt;
}

export const expectMatch = (
  match: Match,
  status: string,
  address: string,
  libraryMap?: { [key: string]: string }
) => {
  expect(match.status).to.equal(status);
  expect(match.address).to.equal(address);
  if (libraryMap) {
    expect(match.libraryMap).to.deep.equal(libraryMap);
  }
};
