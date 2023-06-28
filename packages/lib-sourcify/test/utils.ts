/* eslint-disable @typescript-eslint/no-var-requires */
// Functions here assume a folder structure like this:
// - contractFolderPath
//   - artifact.json
//   - metadata.json
//   - sources
//     - source1.sol
//     - source2.sol

import path from 'path';
import fs from 'fs';
import {
  /* ContextVariables, */ Match,
  SourcifyChain,
  verifyDeployed,
} from '../src';
import { checkFiles } from '../src';
import { expect } from 'chai';
import { ContractFactory, Signer } from 'ethers';
/**
 *  Function to deploy contracts from provider unlocked accounts
 *
 * @returns the address of the deployed contract and the creator tx hash
 */
// TODO: ABI type definition
export async function deployFromAbiAndBytecode(
  signer: Signer,
  contractFolderPath: string,
  args?: any[]
) {
  const artifact = require(path.join(contractFolderPath, 'artifact.json'));
  // Deploy contract
  const contractFactory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer
  );
  const deployment = await contractFactory.deploy(...(args || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  const creationTx = deployment.deploymentTransaction();
  if (!creationTx) {
    throw new Error(
      `No deployment transaction found for ${contractAddress} in contract folder ${contractFolderPath}`
    );
  }
  return { contractAddress, txHash: creationTx.hash };
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
  /* contextVariables?: ContextVariables, */
  creatorTxHash?: string
) => {
  const checkedContracts = await checkFilesFromContractFolder(
    contractFolderPath
  );

  const match = await verifyDeployed(
    checkedContracts[0],
    sourcifyChain,
    address,
    /* contextVariables, */
    creatorTxHash
  );
  return match;
};

/**
 * Creates a CheckedContract[] from the files under contractFolderPath.
 * The metadata must be at contractFolderPath/metadata.json and the sources must be under contractFolderPath/sources.
 */
export const checkFilesFromContractFolder = async (
  contractFolderPath: string
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
  return checkedContracts;
};
/**
 * Combines both deploying and verifying a contract in a single function.
 * Returns the deployed address for assertions on Match.address
 */
export const deployCheckAndVerify = async (
  contractFolderPath: string,
  sourcifyChain: SourcifyChain,
  signer: Signer,
  args?: any[]
) => {
  const { contractAddress } = await deployFromAbiAndBytecode(
    signer,
    contractFolderPath,
    args
  );
  const match = await checkAndVerifyDeployed(
    contractFolderPath,
    sourcifyChain,
    contractAddress
  );
  return { match, contractAddress };
};

export const expectMatch = (
  match: Match,
  status: string | null,
  address: string,
  libraryMap?: { [key: string]: string },
  message?: string
) => {
  try {
    expect(match.status).to.equal(status);
    expect(match.address).to.equal(address);
    if (libraryMap) {
      expect(match.libraryMap).to.deep.equal(libraryMap);
    }
    if (message) {
      expect(match.message).to.equal(message);
    }
  } catch (e) {
    console.log('Match: ', match);
    throw e;
  }
};
