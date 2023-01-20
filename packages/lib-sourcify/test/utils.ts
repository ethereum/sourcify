/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import Web3 from 'web3';
import fs from 'fs';
import { SourcifyChain, verifyDeployed } from '../src';
import { checkFiles } from '../src';

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
  address: string
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
    address
  );
  return match;
};
