import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { Verification } from '../../src/Verification/Verification';
import SourcifyChain from '../../src/lib/SourcifyChain';
import { ChildProcess } from 'child_process';
import { JsonRpcSigner } from 'ethers';
import path from 'path';
import { deployFromAbiAndBytecode, expectMatch } from '../utils';
import {
  startHardhatNetwork,
  stopHardhatNetwork,
} from '../hardhat-network-helper';
import { SolidityMetadataContract } from '../../src/Validation/SolidityMetadataContract';
import {
  ISolidityCompiler,
  SolidityOutput,
} from '../../src/Compilation/SolidityTypes';
import { PathContent } from '../../src/lib/types';
import { useSolidityCompiler } from '../compiler/solidityCompiler';
import { findSolcPlatform } from '../compiler/solidityCompiler';
import fs from 'fs';

class TestSolidityCompiler implements ISolidityCompiler {
  async compile(
    version: string,
    solcJsonInput: any,
    forceEmscripten = false,
  ): Promise<SolidityOutput> {
    return useSolidityCompiler(version, solcJsonInput, forceEmscripten);
  }
}

// Helper function to get compilation from metadata
async function getCompilationFromMetadata(contractFolderPath: string) {
  // Read metadata.json directly
  const metadataPath = path.join(contractFolderPath, 'metadata.json');
  const metadataRaw = fs.readFileSync(metadataPath, 'utf8');
  const metadata = JSON.parse(metadataRaw);

  // Read source files from the sources directory
  const sourcesPath = path.join(contractFolderPath, 'sources');
  const sources: PathContent[] = [];

  // Get all source files from metadata
  for (const [sourcePath] of Object.entries(metadata.sources)) {
    // Extract filename from source path (e.g. "contracts/Storage.sol" -> "Storage.sol")
    const fileName = sourcePath.split('/').pop() || sourcePath;
    const filePath = path.join(sourcesPath, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    sources.push({
      path: sourcePath,
      content,
    });
  }

  // Create metadata contract
  const metadataContract = new SolidityMetadataContract(metadata, sources);

  // Create compilation
  return await metadataContract.createCompilation(new TestSolidityCompiler());
}

const HARDHAT_PORT = 8544;

const UNUSED_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

const hardhatChain = {
  name: 'Hardhat Network Localhost',
  shortName: 'Hardhat Network',
  chainId: 31337,
  faucets: [],
  infoURL: 'localhost',
  nativeCurrency: { name: 'localETH', symbol: 'localETH', decimals: 18 },
  network: 'testnet',
  networkId: 31337,
  rpc: [`http://localhost:${HARDHAT_PORT}`],
  supported: true,
};

const sourcifyChainHardhat: SourcifyChain = new SourcifyChain(hardhatChain);

let hardhatNodeProcess: ChildProcess;
let signer: JsonRpcSigner;

describe('Verification Class Tests', () => {
  before(async () => {
    hardhatNodeProcess = await startHardhatNetwork(HARDHAT_PORT);
    signer = await sourcifyChainHardhat.providers[0].getSigner();
  });

  after(async () => {
    await stopHardhatNetwork(hardhatNodeProcess);
  });

  describe('Basic Contract Verification', () => {
    it('should verify a simple contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Storage',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
        },
        'perfect',
        contractAddress,
      );
    });

    it('should partially verify a simple contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Storage',
      );
      const modifiedContractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'StorageModified',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const compilation = await getCompilationFromMetadata(
        modifiedContractFolderPath,
      );
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
        },
        'partial',
        contractAddress,
      );
    });

    it('should fail to verify a non-existing address', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Storage',
      );
      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        UNUSED_ADDRESS,
      );

      try {
        await verification.verify();
      } catch (err: any) {
        expect(err.message).to.equal(
          `Chain #${sourcifyChainHardhat.chainId} does not have a contract deployed at ${UNUSED_ADDRESS}.`,
        );
      }
    });

    it('should fail when chain is temporarily unavailable', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Storage',
      );
      // Create a chain with invalid RPC to simulate unavailability
      const unavailableChain = new SourcifyChain({
        ...hardhatChain,
        rpc: ['http://localhost:1234'],
      });

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        unavailableChain,
        UNUSED_ADDRESS,
      );

      try {
        await verification.verify();
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err.message).to.include(`None of the RPCs responded fetching`);
      }
    });
  });

  describe('Library Contract Verification', () => {
    it('should verify a contract with library placeholders', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'UsingLibrary',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      const expectedLibraryMap = {
        __$da572ae5e60c838574a0f88b27a0543803$__:
          '11fea6722e00ba9f43861a6e4da05fecdf9806b7',
      };

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
          libraryMap: verification.getLibraryMap(),
        },
        'perfect',
        contractAddress,
        expectedLibraryMap,
      );
    });
  });

  describe('Immutable Contract Verification', () => {
    it('should verify a contract with immutables', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'WithImmutables',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        ['12345'],
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
        },
        'perfect',
        contractAddress,
      );
    });
  });

  describe('Verification Results', () => {
    it('should return correct verification status and bytecodes', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Storage',
      );

      // Deploy the contract
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      // Get compilation using the helper
      const compilation = await getCompilationFromMetadata(contractFolderPath);

      // Create and verify using the Verification class directly
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      // Test getStatus
      const status = verification.getStatus();
      expect(status.runtimeMatch).to.equal('perfect');

      // Test getBytecodes
      const bytecodes = verification.getBytecodes();
      expect(bytecodes.onchainRuntimeBytecode).to.be.a('string');

      // Test getTransformations
      const transformations = verification.getTransformations();
      expect(transformations).to.have.property('runtimeTransformations');
      expect(transformations).to.have.property('creationTransformations');

      // Test getDeploymentInfo
      const deploymentInfo = verification.getDeploymentInfo();
      expect(deploymentInfo).to.have.property('blockNumber');

      // Test getLibraryMap
      const libraryMap = verification.getLibraryMap();
      expect(libraryMap).to.deep.equal({});
    });
  });

  describe('ViaIR Compilation', () => {
    it('should verify a contract with viaIR:true', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'StorageViaIR',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
        },
        'perfect',
        contractAddress,
      );
    });

    it('should verify a contract with viaIR:true, optimizer disabled, and compiler <0.8.21', async function () {
      const solcPlatform = findSolcPlatform();
      // can't really run this if we can't run a platform-native binary but only Emscripten (solc-js)
      if (!solcPlatform) {
        console.log(
          `skipping test as the running machine can't run a platform-native binary. The platform and architechture is ${process.platform} ${process.arch}`,
        );
        this.skip();
      }

      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'ViaIRUnoptimizedMismatch',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
        },
        'perfect',
        contractAddress,
      );
    });
  });

  describe('Creation Transaction Verification', () => {
    it('should verify with creation transaction hash', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'WithImmutables',
      );
      const { contractAddress, txHash } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        ['12345'],
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);
      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
        txHash,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.getStatus().runtimeMatch,
          creationMatch: verification.getStatus().creationMatch,
        },
        'perfect',
        contractAddress,
      );
    });
  });
});
