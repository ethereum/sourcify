import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { Verification } from '../../src/Verification/Verification';
import SourcifyChain from '../../src/SourcifyChain';
import { ChildProcess } from 'child_process';
import { JsonRpcSigner } from 'ethers';
import path from 'path';
import { deployFromAbiAndBytecode, expectMatch, vyperCompiler } from '../utils';
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
import { VyperCompilation } from '../../src/Compilation/VyperCompilation';

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

// Helper function to create Vyper compilation
async function createVyperCompilation(
  contractFolderPath: string,
  version: string,
  settings: {
    evmVersion?: 'london' | 'paris' | 'shanghai' | 'cancun' | 'istanbul';
    optimize?: 'gas' | 'codesize' | 'none' | boolean;
  } = { evmVersion: 'istanbul' },
) {
  const contractFileName = 'test.vy';
  const contractFileContent = await fs.promises.readFile(
    path.join(contractFolderPath, contractFileName),
  );

  return new VyperCompilation(
    vyperCompiler,
    version,
    {
      language: 'Vyper',
      sources: {
        [contractFileName]: {
          content: contractFileContent.toString(),
        },
      },
      settings: {
        ...settings,
        outputSelection: {
          '*': ['evm.bytecode'],
        },
      },
    },
    {
      path: contractFileName,
      name: contractFileName.split('.')[0],
    },
  );
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
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

    it('should return partial match when there is perfect bytecode match but no auxdata', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'NoAuxdata',
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
        },
        'partial',
        contractAddress,
      );
    });

    it('should return null match when there is no perfect match and no auxdata', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'NoAuxdata',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const compilation = await getCompilationFromMetadata(contractFolderPath);

      Object.defineProperty(compilation, 'runtimeBytecode', {
        get: () =>
          '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const verification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      try {
        await verification.verify();
      } catch (e: any) {
        expect(e.message).to.equal(
          "The deployed and recompiled bytecode don't match.",
        );
      }
    });

    it('should add constructor transformation with correct offset and arguments', async () => {
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

      const transformations = verification.transformations;
      expect(transformations.creation.list).to.deep.include({
        type: 'insert',
        reason: 'constructorArguments',
        offset: 970,
      });
      expect(transformations.creation.values?.constructorArguments).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000003039',
      );
    });

    it('should detect extra file input bug when optimizer is enabled', async () => {
      // Deploy the original contract
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'ExtraFilesBytecodeMismatch',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      // Try to verify with a compilation that has extra files
      const compilation = await getCompilationFromMetadata(contractFolderPath);

      const failingVerification = new Verification(
        compilation,
        sourcifyChainHardhat,
        contractAddress,
      );

      try {
        await failingVerification.verify();
      } catch (err: any) {
        expect(err.message).to.include(
          "It seems your contract's metadata hashes match but not the bytecodes",
        );
        expect(err.message).to.include(
          'https://github.com/ethereum/sourcify/issues/618',
        );
      }

      // Read all files from the sources directory
      const sourcesPath = path.join(contractFolderPath, 'complete_sources');
      const sourceFiles: string[] = [];
      const readDirRecursively = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            readDirRecursively(fullPath);
          } else {
            sourceFiles.push(fullPath);
          }
        }
      };
      readDirRecursively(sourcesPath);

      const additionalSources: Record<string, { content: string }> = {};
      for (const fullPath of sourceFiles) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const relativePath = path.relative(sourcesPath, fullPath);
        additionalSources[relativePath] = { content };
      }

      // Use the full sources as the input
      compilation.jsonInput.sources = additionalSources;

      // Try to verify again with the full sources
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
        },
        'perfect',
        contractAddress,
      );
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
          libraryMap: verification.libraryMap,
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
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
      const { contractAddress, txHash } = await deployFromAbiAndBytecode(
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
        txHash,
      );
      await verification.verify();

      // This test just checks that Verification's getter properties return values formatted correctly

      // Test getStatus
      const status = verification.status;
      expect(status.runtimeMatch).to.equal('perfect');

      // Test onchainRuntimeBytecode
      expect(verification.onchainRuntimeBytecode).to.be.a('string');

      // Test onchainCreationBytecode
      expect(verification.onchainCreationBytecode).to.be.a('string');

      // Test getTransformations
      const transformations = verification.transformations;
      expect(transformations).to.have.property('runtime');
      expect(transformations).to.have.property('creation');

      // Test getDeploymentInfo
      const deploymentInfo = verification.deploymentInfo;
      expect(deploymentInfo).to.have.property('blockNumber');

      // Test getLibraryMap
      const libraryMap = verification.libraryMap;
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
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
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
        },
        'perfect',
        contractAddress,
      );
    });
  });

  describe('Vyper Compilation Tests', () => {
    // TODO: implement constructor argument transformation test
    it('should verify a simple Vyper contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Vyper',
        'testcontract',
      );
      const { contractAddress, txHash } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const vyperCompilation = await createVyperCompilation(
        contractFolderPath,
        '0.3.10+commit.91361694',
      );

      const verification = new Verification(
        vyperCompilation,
        sourcifyChainHardhat,
        contractAddress,
        txHash,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
        },
        'partial',
        contractAddress,
      );
    });

    it('should verify a Vyper contract with immutables', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Vyper',
        'withImmutables',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        [5], // Constructor argument for immutable value
      );

      const vyperCompilation = await createVyperCompilation(
        contractFolderPath,
        '0.4.0+commit.e9db8d9f',
        {
          evmVersion: 'london',
          optimize: 'codesize',
        },
      );

      const verification = new Verification(
        vyperCompilation,
        sourcifyChainHardhat,
        contractAddress,
      );
      await verification.verify();

      expectMatch(
        {
          address: contractAddress,
          chainId: sourcifyChainHardhat.chainId.toString(),
          runtimeMatch: verification.status.runtimeMatch,
          creationMatch: verification.status.creationMatch,
        },
        'partial',
        contractAddress,
      );

      // Check if immutable values are correctly set
      const transformations = verification.transformations;
      expect(transformations.runtime.list).to.deep.include({
        type: 'insert',
        reason: 'immutable',
        offset: 167,
        id: '0',
      });
    });

    it('should fail to verify when using wrong Vyper contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Vyper',
        'testcontract',
      );
      const wrongContractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Vyper',
        'testcontract2',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const vyperCompilation = await createVyperCompilation(
        wrongContractFolderPath,
        '0.3.10+commit.91361694',
      );

      const verification = new Verification(
        vyperCompilation,
        sourcifyChainHardhat,
        contractAddress,
      );

      try {
        await verification.verify();
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err.message).to.equal(
          "The deployed and recompiled bytecode don't match.",
        );
      }
    });

    it('should handle Vyper contracts with different auxdata versions', async () => {
      const contractFolderPath = path.join(
        __dirname,
        '..',
        'sources',
        'Vyper',
        'testcontract',
      );
      const { contractAddress, txHash } = await deployFromAbiAndBytecode(
        signer,
        path.join(contractFolderPath, 'wrongAuxdata'),
      );

      const vyperCompilation = await createVyperCompilation(
        contractFolderPath,
        '0.3.10+commit.91361694',
      );

      const verification = new Verification(
        vyperCompilation,
        sourcifyChainHardhat,
        contractAddress,
        txHash,
      );
      await verification.verify();

      const transformations = verification.transformations;
      expect(transformations.creation.list).to.deep.include({
        type: 'replace',
        reason: 'cborAuxdata',
        offset: 158,
        id: '1',
      });
      expect(transformations.creation.values?.cborAuxdata?.['1']).to.equal(
        '0x84188f8000a1657679706572830003090012',
      );
    });
  });
});
