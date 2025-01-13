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
import { Match, SourcifyChain, verifyDeployed } from '../src';
import { checkFilesWithMetadata } from '../src';
import { expect } from 'chai';
import { ContractFactory, Signer } from 'ethers';
import { useSolidityCompiler } from './compiler/solidityCompiler';
import { useVyperCompiler } from './compiler/vyperCompiler';
import {
  IVyperCompiler,
  VyperJsonInput,
  VyperOutput,
} from '../src/lib/IVyperCompiler';
import {
  ISolidityCompiler,
  SolidityJsonInput,
  SolidityOutput,
} from '../src/Compilation/SolidityTypes';
/**
 *  Function to deploy contracts from provider unlocked accounts
 *  contractFolderPath must contain an artifact.json file with "abi" and "bytecode" fields
 *
 * @returns the address of the deployed contract and the creator tx hash
 */
// TODO: ABI type definition
export async function deployFromAbiAndBytecode(
  signer: Signer,
  contractFolderPath: string,
  constructorArgs?: any[],
) {
  const artifact = require(path.join(contractFolderPath, 'artifact.json'));
  // Deploy contract
  const contractFactory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer,
  );
  const deployment = await contractFactory.deploy(...(constructorArgs || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  const creationTx = deployment.deploymentTransaction();
  if (!creationTx) {
    throw new Error(
      `No deployment transaction found for ${contractAddress} in contract folder ${contractFolderPath}`,
    );
  }
  return { contractAddress, txHash: creationTx.hash };
}

class Solc implements ISolidityCompiler {
  async compile(
    version: string,
    solcJsonInput: SolidityJsonInput,
    forceEmscripten: boolean = false,
  ): Promise<SolidityOutput> {
    return await useSolidityCompiler(version, solcJsonInput, forceEmscripten);
  }
}

export const solc = new Solc();

class VyperCompiler implements IVyperCompiler {
  async compile(
    version: string,
    solcJsonInput: VyperJsonInput,
  ): Promise<VyperOutput> {
    return await useVyperCompiler(
      path.join('/tmp', 'vyper-repo'),
      version,
      solcJsonInput,
    );
  }
}

export const vyperCompiler = new VyperCompiler();

/**
 * Checks the contract from metadata and source files under contractFolderPath and
 * verifies it on sourcifyChain at address.
 * The metadata must be at contractFolderPath/metadata.json and the sources must be under contractFolderPath/sources.
 */
export const checkAndVerifyDeployed = async (
  contractFolderPath: string,
  sourcifyChain: SourcifyChain,
  address: string,
  creatorTxHash?: string,
) => {
  const checkedContracts =
    await checkFilesWithMetadataFromContractFolder(contractFolderPath);

  const match = await verifyDeployed(
    checkedContracts[0],
    sourcifyChain,
    address,
    creatorTxHash,
  );
  return match;
};

/**
 * Creates a CheckedContract[] from the files under contractFolderPath.
 * The metadata must be at contractFolderPath/metadata.json and the sources must be under contractFolderPath/sources.
 */
export const checkFilesWithMetadataFromContractFolder = async (
  contractFolderPath: string,
) => {
  const metadataPath = path.join(contractFolderPath, 'metadata.json');
  const metadataBuffer = fs.readFileSync(metadataPath);
  const metadataPathBuffer = { path: metadataPath, buffer: metadataBuffer };

  const sourcePathBuffers: { path: string; buffer: Buffer }[] = [];
  const traverseDirectory = (dirPath: string, basePath: string = '') => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        traverseDirectory(fullPath, relativePath);
      } else {
        const sourceBuffer = fs.readFileSync(fullPath);
        sourcePathBuffers.push({ path: relativePath, buffer: sourceBuffer });
      }
    }
  };
  traverseDirectory(path.join(contractFolderPath, 'sources'));
  const checkedContracts = await checkFilesWithMetadata(solc, vyperCompiler, [
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
  args?: any[],
) => {
  const { contractAddress } = await deployFromAbiAndBytecode(
    signer,
    contractFolderPath,
    args,
  );
  const match = await checkAndVerifyDeployed(
    contractFolderPath,
    sourcifyChain,
    contractAddress,
  );
  return { match, contractAddress };
};

export const expectMatch = (
  match: Match,
  status: string | null,
  address: string,
  libraryMap?: { [key: string]: string },
  message?: string,
) => {
  try {
    expect(match.runtimeMatch).to.equal(status);
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
