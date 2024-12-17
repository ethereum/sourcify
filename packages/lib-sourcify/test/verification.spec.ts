/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import { Match, Metadata } from '../src/lib/types';
import {
  /* callContractMethodWithTx, */
  checkAndVerifyDeployed,
  checkFilesWithMetadataFromContractFolder,
  deployCheckAndVerify,
  deployFromAbiAndBytecode,
  expectMatch,
  vyperCompiler,
} from './utils';
import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import {
  VyperCheckedContract,
  SourcifyChain,
  calculateCreate2Address,
  /* 
  getBytecode,
  matchWithSimulation,
  */
  matchWithCreationTx,
  replaceImmutableReferences,
  verifyCreate2,
  verifyDeployed,
} from '../src';

import fs from 'fs';
import { JsonRpcSigner } from 'ethers';
import { findSolcPlatform } from './compiler/solidityCompiler';
import { ChildProcess } from 'child_process';
import {
  startHardhatNetwork,
  stopHardhatNetwork,
} from './hardhat-network-helper';
import { AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';

const HARDHAT_PORT = 8544;

const UNUSED_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // checksum valid

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

describe('lib-sourcify tests', () => {
  before(async () => {
    hardhatNodeProcess = await startHardhatNetwork(HARDHAT_PORT);
    signer = await sourcifyChainHardhat.providers[0].getSigner();
  });

  after(async () => {
    await stopHardhatNetwork(hardhatNodeProcess);
  });

  describe('Verification tests', () => {
    it('should verify a simple contract', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Storage');
      const { match, contractAddress } = await deployCheckAndVerify(
        contractFolderPath,
        sourcifyChainHardhat,
        signer,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    it('should partially verify a simple contract', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Storage');
      const modifiedContractFolderPath = path.join(
        __dirname,
        'sources',
        'StorageModified',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );
      const match = await checkAndVerifyDeployed(
        modifiedContractFolderPath, // Using the modified contract
        sourcifyChainHardhat,
        contractAddress,
      );

      expectMatch(match, 'partial', contractAddress);
    });

    it('should fail to verify a different simple contract', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Storage');
      const wrongContractFolderPath = path.join(
        __dirname,
        'sources',
        'UsingLibrary',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );
      try {
        await checkAndVerifyDeployed(
          wrongContractFolderPath, // Using the wrong contract
          sourcifyChainHardhat,
          contractAddress,
        );
        throw new Error('Should have failed');
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).to.equal(
            "The deployed and recompiled bytecode don't match.",
          );
        } else {
          throw err;
        }
      }
    });

    it('should fail to verify a non-existing address', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Storage');
      const match = await checkAndVerifyDeployed(
        contractFolderPath, // Using the wrong contract
        sourcifyChainHardhat,
        UNUSED_ADDRESS,
      );
      expectMatch(
        match,
        null,
        UNUSED_ADDRESS,
        undefined,
        `Chain #${sourcifyChainHardhat.chainId} does not have a contract deployed at ${UNUSED_ADDRESS}.`,
      );
    });

    it('should verify a contract with library placeholders', async () => {
      // Originally https://goerli.etherscan.io/address/0x399B23c75d8fd0b95E81E41e1c7c88937Ee18000#code
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'UsingLibrary',
      );
      const { match, contractAddress } = await deployCheckAndVerify(
        contractFolderPath,
        sourcifyChainHardhat,
        signer,
      );
      const expectedLibraryMap = {
        __$da572ae5e60c838574a0f88b27a0543803$__:
          '11fea6722e00ba9f43861a6e4da05fecdf9806b7',
      };
      expectMatch(match, 'perfect', contractAddress, expectedLibraryMap);
    });

    it('should verify a contract with viaIR:true', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'StorageViaIR',
      );
      const { match, contractAddress } = await deployCheckAndVerify(
        contractFolderPath,
        sourcifyChainHardhat,
        signer,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    it('should verify a contract with immutables', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WithImmutables',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        ['12345'],
      );

      const match = await checkAndVerifyDeployed(
        contractFolderPath,
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    it('should verify a create2 contract', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Create2');
      const checkedContracts =
        await checkFilesWithMetadataFromContractFolder(contractFolderPath);
      const saltNum = 12345;
      const saltHex = '0x' + saltNum.toString(16);
      const match = await verifyCreate2(
        checkedContracts[0],
        '0xd9145CCE52D386f254917e481eB44e9943F39138',
        saltHex,
        '0x801B9c0Ee599C3E5ED60e4Ec285C95fC9878Ee64',
        '0x0000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc4',
      );
      expectMatch(
        match,
        'perfect',
        '0x801B9c0Ee599C3E5ED60e4Ec285C95fC9878Ee64',
      );
    });

    it('should verify fail to a create2 contract with wrong address', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Create2');
      const checkedContracts =
        await checkFilesWithMetadataFromContractFolder(contractFolderPath);
      const saltNum = 12345;
      const saltHex = '0x' + saltNum.toString(16);
      try {
        await verifyCreate2(
          checkedContracts[0],
          '0xd9145CCE52D386f254917e481eB44e9943F39138',
          saltHex,
          UNUSED_ADDRESS,
          '0x0000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc4',
        );
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).to.equal(
            `The provided create2 address doesn't match server's generated one. Expected: 0x801B9c0Ee599C3E5ED60e4Ec285C95fC9878Ee64 ; Received: ${UNUSED_ADDRESS} ;`,
          );
        } else {
          throw err;
        }
      }
    });
    // https://github.com/ethereum/sourcify/issues/640
    it('should remove the inliner option from metadata for solc >=0.8.2 to <=0.8.4 and be able to verify', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'StorageInliner',
      );
      const { match, contractAddress } = await deployCheckAndVerify(
        contractFolderPath,
        sourcifyChainHardhat,
        signer,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    /* it('should verify a contract created by a factory contract and has immutables', async () => {
      const deployValue = 12345;
      const childFolderPath = path.join(
        __dirname,
        'sources',
        'FactoryImmutable',
        'Child'
      );
      const factoryFolderPath = path.join(
        __dirname,
        'sources',
        'FactoryImmutable',
        'Factory'
      );
      const [factoryAddress] = await deployFromAbiAndBytecode(
        localProvider,
        factoryFolderPath,
        signer,
        [deployValue]
      );

      // Deploy the child by calling the factory
      const txReceipt = await callContractMethodWithTx(
        localProvider,
        factoryFolderPath,
        factoryAddress,
        'deploy',
        signer,
        [deployValue]
      );
      const childAddress = txReceipt.events.Deployment.returnValues[0];
      const abiEncoded = localProvider.eth.abi.encodeParameter(
        'uint',
        deployValue
      );
      const match = await checkAndVerifyDeployed(
        childFolderPath,
        sourcifyChainGanache,
        childAddress,
        {
          abiEncodedConstructorArguments: abiEncoded,
        }
      );

      expectMatch(match, 'perfect', childAddress);
    }); */

    /* it('should verify a contract created by a factory contract and has immutables without constructor arguments but with msg.sender assigned immutable', async () => {
      const childFolderPath = path.join(
        __dirname,
        'sources',
        'FactoryImmutableWithoutConstrArg',
        'Child'
      );
      const factoryFolderPath = path.join(
        __dirname,
        'sources',
        'FactoryImmutableWithoutConstrArg',
        'Factory'
      );
      const [factoryAddress] = await deployFromAbiAndBytecode(
        localProvider,
        factoryFolderPath,
        signer,
        []
      );

      // Deploy the child by calling the factory
      const txReceipt = await callContractMethodWithTx(
        localProvider,
        factoryFolderPath,
        factoryAddress,
        'createChild',
        signer,
        []
      );
      const childAddress = txReceipt.events.ChildCreated.returnValues[0];
      const match = await checkAndVerifyDeployed(
        childFolderPath,
        sourcifyChainGanache,
        childAddress,
        {
          msgSender: factoryAddress,
        }
      );

      expectMatch(match, 'perfect', childAddress);
    });
    */
    it('should fully verify a contract which is originally compiled and deployed with Unix style End Of Line (EOL) source code, but being verified with Windows style (CRLF) EOL source code', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WrongMetadata',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const match = await checkAndVerifyDeployed(
        contractFolderPath,
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    it('should fully verify a contract when a not alphabetically sorted metadata is provided', async () => {
      const contractFolderPath = path.join(__dirname, 'sources', 'Storage');
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const checkedContracts =
        await checkFilesWithMetadataFromContractFolder(contractFolderPath);

      // Get the unsorted metadata
      const metadataPath = path.join(
        path.join(__dirname, 'sources', 'StorageUnsortedMetadata'),
        'metadata.json',
      );
      const metadataBuffer = fs.readFileSync(metadataPath);

      // Replace the metadata witht he unsorted one
      checkedContracts[0].initSolcJsonInput(
        JSON.parse(metadataBuffer.toString()),
        checkedContracts[0].sources,
      );

      const match = await verifyDeployed(
        checkedContracts[0],
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    it('should fully verify a library with call protection when viaIR is disabled (legacy compilation placeholder: 0x73 plus 20 zero bytes)', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'CallProtectionForLibraries',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const match = await checkAndVerifyDeployed(
        contractFolderPath,
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    it('should fully verify a library with call protection when viaIR is enabled', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'CallProtectionForLibrariesViaIR',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );

      const match = await checkAndVerifyDeployed(
        contractFolderPath,
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    // https://github.com/ethereum/sourcify/issues/1159
    it('should compile nightly using Emscripten', async function () {
      const contractFolderPath = path.join(__dirname, 'sources', 'Nightly');
      const solcPlatform = findSolcPlatform();
      // can't really run this if we can't run a platform-native binary but only Emscripten (solc-js)
      if (!solcPlatform) {
        console.log(
          `skipping test as the running machine can't run a platform-native binary. The platform and architechture is ${process.platform} ${process.arch}`,
        );
        this.skip();
      }
      // The artifact has the bytecode from the Emscripten compiler.
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );
      const match = await checkAndVerifyDeployed(
        contractFolderPath,
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });

    // https://github.com/ethereum/sourcify/issues/1088
    it('should compile again with a different platform binary and verify for contracts --viaIR and optimizer disabled <=v0.8.20', async function () {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'ViaIRUnoptimizedMismatch',
      );
      const solcPlatform = findSolcPlatform();
      // can't really run this if we can't run a platform-native binary but only Emscripten (solc-js)
      if (!solcPlatform) {
        console.log(
          `skipping test as the running machine can't run a platform-native binary. The platform and architechture is ${process.platform} ${process.arch}`,
        );
        this.skip();
      }
      // The artifact has the bytecode from the Emscripten compiler.
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
      );
      const match = await checkAndVerifyDeployed(
        contractFolderPath,
        sourcifyChainHardhat,
        contractAddress,
      );
      expectMatch(match, 'perfect', contractAddress);
    });
  });

  it('should rewrite metadata on CheckedContract after recompilation', async () => {
    const contractFolderPath = path.join(
      __dirname,
      'sources',
      'MetadataRewriting',
      'contract',
    );
    const { contractAddress } = await deployFromAbiAndBytecode(
      signer,
      contractFolderPath,
      [
        '0x39f0bd56c1439a22ee90b4972c16b7868d161981',
        '0x000000000000000000000000000000000000dead',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ],
    );
    const checkedContracts =
      await checkFilesWithMetadataFromContractFolder(contractFolderPath);

    const match = await verifyDeployed(
      checkedContracts[0],
      sourcifyChainHardhat,
      contractAddress,
    );
    expectMatch(match, 'perfect', contractAddress);

    const correctMetadataRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          'sources',
          'MetadataRewriting',
          'correct-metadata.json',
        ),
      )
      .toString();

    expect(checkedContracts[0].metadata).to.deep.equal(
      JSON.parse(correctMetadataRaw),
    );
    expect(checkedContracts[0].metadataRaw).to.equal(correctMetadataRaw);
  });

  // For https://github.com/ethereum/sourcify/pull/1623
  it('should verify a contract partially with the creation bytecode after transformation fields are normalized', async () => {
    const contractFolderPath = path.join(
      __dirname,
      'sources',
      'ConstructorModified',
    );
    const { contractAddress, txHash } = await deployFromAbiAndBytecode(
      signer,
      contractFolderPath,
      ['12345'],
    );
    const match = await checkAndVerifyDeployed(
      contractFolderPath,
      sourcifyChainHardhat,
      contractAddress,
      txHash,
    );
    expect(match.creationMatch).to.equal('partial');
    expect(match.creationTransformations).to.deep.equal([
      {
        type: 'replace',
        reason: 'cborAuxdata',
        offset: 279,
        id: '1',
      },
      {
        type: 'insert',
        reason: 'constructorArguments',
        offset: 332,
      },
    ]);
    expect(match.creationTransformationValues).to.deep.equal({
      cborAuxdata: {
        '1': '0xa26469706673582212208a693a7ed29129e25fc67a65f83955fb3d86f5fbc378940d697827714b955df564736f6c634300081a0033',
      },
      constructorArguments:
        '0x0000000000000000000000000000000000000000000000000000000000003039',
    });
  });

  describe.only('Vyper', () => {
    it('should verify a vyper contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'Vyper',
        'testcontract',
      );
      const contractFileName = 'test.vy';
      const vyperContent = await fs.promises.readFile(
        path.join(contractFolderPath, contractFileName),
      );

      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        [],
      );
      const checkedContract = new VyperCheckedContract(
        vyperCompiler,
        '0.3.10+commit.91361694',
        contractFileName,
        contractFileName.split('.')[0],
        {
          evmVersion: 'istanbul',
          outputSelection: {
            '*': ['evm.bytecode'],
          },
        },
        {
          [contractFileName]: vyperContent.toString(),
        },
      );
      const match = await verifyDeployed(
        checkedContract,
        sourcifyChainHardhat,
        contractAddress,
      );

      expectMatch(match, 'partial', contractAddress);
    });

    it('should verify a vyper contract with immutable references and constructor arguments', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'Vyper',
        'withImmutables',
      );
      const contractFileName = 'test.vy';
      const vyperContent = await fs.promises.readFile(
        path.join(contractFolderPath, contractFileName),
      );

      console.log('deploying', await signer.getAddress());
      const { contractAddress, txHash } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        [5],
      );
      const checkedContract = new VyperCheckedContract(
        vyperCompiler,
        '0.4.0+commit.e9db8d9f',
        contractFileName,
        contractFileName.split('.')[0],
        {
          evmVersion: 'london',
          outputSelection: {
            '*': ['evm.bytecode'],
          },
          optimize: 'codesize',
        },
        {
          [contractFileName]: vyperContent.toString(),
        },
      );
      const match = await verifyDeployed(
        checkedContract,
        sourcifyChainHardhat,
        contractAddress,
        txHash,
      );

      expectMatch(match, 'partial', contractAddress);
      expect(match.creationMatch).to.equal('partial');
      expect(match.creationTransformations).to.deep.equal([
        {
          type: 'insert',
          reason: 'constructorArguments',
          offset: 245,
        },
      ]);
      expect(match.creationTransformationValues).to.deep.equal({
        constructorArguments:
          '0x0000000000000000000000000000000000000000000000000000000000000005',
      });
      expect(match.runtimeTransformations).to.deep.equal([
        {
          type: 'replace',
          reason: 'immutable',
          offset: 167,
          id: '0',
        },
      ]);
      expect(match.runtimeTransformationValues).to.deep.equal({
        immutables: {
          '0': '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000eca7a2f8618d6f',
        },
      });
    });

    it('should fail to verify a different Vyper contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'Vyper',
        'testcontract',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        [],
      );

      const contractFileName = 'test.vy';
      const wrongContractContent = await fs.promises.readFile(
        path.join(
          __dirname,
          'sources',
          'Vyper',
          'testcontract2',
          contractFileName,
        ),
      );
      const checkedContract = new VyperCheckedContract(
        vyperCompiler,
        '0.3.10+commit.91361694',
        contractFileName,
        contractFileName.split('.')[0],
        {
          evmVersion: 'istanbul',
          outputSelection: {
            '*': ['evm.bytecode'],
          },
        },
        {
          [contractFileName]: wrongContractContent.toString(),
        },
      );

      await expect(
        verifyDeployed(checkedContract, sourcifyChainHardhat, contractAddress),
      ).to.be.rejectedWith("The deployed and recompiled bytecode don't match.");
    });
  });

  describe('Unit tests', function () {
    describe('SourcifyChain', () => {
      it("Should fail to instantiate with empty rpc's", function () {
        const emptyRpc = { ...hardhatChain, rpc: [] };
        try {
          new SourcifyChain(emptyRpc);
          throw new Error('Should have failed');
        } catch (err) {
          if (err instanceof Error) {
            expect(err.message).to.equal(
              'No RPC provider was given for this chain with id ' +
                emptyRpc.chainId +
                ' and name ' +
                emptyRpc.name,
            );
          } else {
            throw err;
          }
        }
      });
      it('Should getBlock', async function () {
        const block = await sourcifyChainHardhat.getBlock(0);
        expect(block?.number).equals(0);
      });
      it('Should getBlockNumber', async function () {
        const blockNumber = await sourcifyChainHardhat.getBlockNumber();
        expect(blockNumber > 0);
      });
      it('Should fail to get non-existing transaction', async function () {
        try {
          await sourcifyChainHardhat.getTx(
            '0x79ab5d59fcb70ca3f290aa39ed3f156a5c4b3897176aebd455cd20b6a30b107a',
          );
          throw new Error('Should have failed');
        } catch (err) {
          if (err instanceof Error) {
            expect(err.message).to.equal(
              `None of the RPCs responded fetching tx 0x79ab5d59fcb70ca3f290aa39ed3f156a5c4b3897176aebd455cd20b6a30b107a on chain ${hardhatChain.chainId}`,
            );
          } else {
            throw err;
          }
        }
      });
    });
    it('Should calculateCreate2Address', async function () {
      expect(
        calculateCreate2Address(
          '0x71CB05EE1b1F506fF321Da3dac38f25c0c9ce6E1',
          '123',
          '0x00',
        ),
      ).equals('0xA0279ea82DF644AFb68FdD4aDa5848C5Df9F116B');
    });

    it('Should replaceImmutableReferences', async function () {
      const runtimeBytecode =
        '0x608060405234801561001057600080fd5b50600436106100415760003560e01c806357de26a41461004657806379d6348d146100c9578063ced7b2e314610184575b600080fd5b61004e6101a2565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561008e578082015181840152602081019050610073565b50505050905090810190601f1680156100bb5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b610182600480360360208110156100df57600080fd5b81019080803590602001906401000000008111156100fc57600080fd5b82018360208201111561010e57600080fd5b8035906020019184600183028401116401000000008311171561013057600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050610244565b005b61018c61025e565b6040518082815260200191505060405180910390f35b606060008054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561023a5780601f1061020f5761010080835404028352916020019161023a565b820191906000526020600020905b81548152906001019060200180831161021d57829003601f168201915b5050505050905090565b806000908051906020019061025a929190610282565b5050565b7f000000000000000000000000000000000000000000000000000000000000000281565b828054600181600116156101000203166002900490600052602060002090601f0160209004810192826102b857600085556102ff565b82601f106102d157805160ff19168380011785556102ff565b828001600101855582156102ff579182015b828111156102fe5782518255916020019190600101906102e3565b5b50905061030c9190610310565b5090565b5b80821115610329576000816000905550600101610311565b509056fea26469706673582212207d766cdc8c3a27e3071e5fbe3fb4327a900c77e0061b473bd4d024da7b147ee564736f6c63430007040033';

      const recompiledRuntimeBytecode =
        '0x608060405234801561001057600080fd5b50600436106100415760003560e01c806357de26a41461004657806379d6348d146100c9578063ced7b2e314610184575b600080fd5b61004e6101a2565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561008e578082015181840152602081019050610073565b50505050905090810190601f1680156100bb5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b610182600480360360208110156100df57600080fd5b81019080803590602001906401000000008111156100fc57600080fd5b82018360208201111561010e57600080fd5b8035906020019184600183028401116401000000008311171561013057600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050610244565b005b61018c61025e565b6040518082815260200191505060405180910390f35b606060008054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561023a5780601f1061020f5761010080835404028352916020019161023a565b820191906000526020600020905b81548152906001019060200180831161021d57829003601f168201915b5050505050905090565b806000908051906020019061025a929190610282565b5050565b7f000000000000000000000000000000000000000000000000000000000000000081565b828054600181600116156101000203166002900490600052602060002090601f0160209004810192826102b857600085556102ff565b82601f106102d157805160ff19168380011785556102ff565b828001600101855582156102ff579182015b828111156102fe5782518255916020019190600101906102e3565b5b50905061030c9190610310565b5090565b5b80821115610329576000816000905550600101610311565b509056fea26469706673582212207d766cdc8c3a27e3071e5fbe3fb4327a900c77e0061b473bd4d024da7b147ee564736f6c63430007040033';
      const immutableReferences = {
        '3': [
          {
            length: 32,
            start: 608,
          },
        ],
      };

      const replacedBytecode = replaceImmutableReferences(
        immutableReferences,
        runtimeBytecode,
        [],
        {},
        AuxdataStyle.SOLIDITY,
      );

      expect(replacedBytecode).equals(recompiledRuntimeBytecode);
    });

    /* 
    it('should matchWithSimulation', async () => {
      const childFolderPath = path.join(
        __dirname,
        'sources',
        'FactoryImmutableWithoutConstrArg',
        'Child'
      );
      const factoryFolderPath = path.join(
        __dirname,
        'sources',
        'FactoryImmutableWithoutConstrArg',
        'Factory'
      );
      const [factoryAddress] = await deployFromAbiAndBytecode(
        signer,
        factoryFolderPath,
        []
      );

      // Deploy the child by calling the factory
      const txReceipt = await callContractMethodWithTx(
        localProvider,
        factoryFolderPath,
        factoryAddress,
        'createChild',
        signer,
        []
      );
      const childAddress = txReceipt.events.ChildCreated.returnValues[0];

      const checkedContracts = await checkFilesWithMetadataFromContractFolder(
        childFolderPath
      );
      const recompiled = await checkedContracts[0].recompile();
      const runtimeBytecode = await getBytecode(
        sourcifyChainGanache,
        childAddress
      );
      const evmVersion = JSON.parse(recompiled.metadata).settings.evmVersion;
      const match: Match = {
        address: childAddress,
        chainId: sourcifyChainGanache.chainId.toString(),
        status: null,
      };

      await matchWithSimulation(
        match,
        recompiled.creationBytecode,
        runtimeBytecode,
        evmVersion,
        sourcifyChainGanache.chainId.toString(),
        {
          msgSender: factoryAddress,
        }
      );

      expectMatch(match, 'perfect', childAddress);
    });
    */

    it('should fail to matchWithCreationTx with wrong creationTxHash', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WithImmutables',
      );
      const { contractAddress } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        ['12345'],
      );

      // Get an arbitrary tx hash
      const { txHash: wrongCreatorTxHash } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        ['12345'],
      );

      const checkedContracts =
        await checkFilesWithMetadataFromContractFolder(contractFolderPath);
      const recompiled = await checkedContracts[0].recompile();
      const match: Match = {
        address: contractAddress,
        chainId: sourcifyChainHardhat.chainId.toString(),
        runtimeMatch: null,
        creationMatch: null,
      };
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);

      const generateCreationCborAuxdataPositions = async () => {
        if (!checkedContracts[0].creationBytecodeCborAuxdata) {
          await checkedContracts[0].generateCborAuxdataPositions();
        }
        return checkedContracts[0].creationBytecodeCborAuxdata || {};
      };
      try {
        await matchWithCreationTx(
          match,
          recompiled.creationBytecode,
          sourcifyChainHardhat,
          contractAddress,
          wrongCreatorTxHash,
          recompiledMetadata,
          generateCreationCborAuxdataPositions,
          recompiled.creationLinkReferences,
        );
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).to.equal(
            "Creator transaction doesn't match the contract",
          );
        } else {
          throw err;
        }
      }
    });

    // https://github.com/sourcifyeth/private-issues/issues/16
    // Shouldn't let the `startsWith` check in `matchWithCreationTx` pass and verify arbitrary contracts with the short constructor code snippet. The attack contract is just a simple constructor. Avoid this by treating the difference of the `startsWith` of the recompiled creation bytecode and the tx.input as constructor arguments.
    it('should fail to matchWithCreationTx with creatorTxHash when trying to maliciously verify with a creation bytecode that startsWith the creatorTx input of the deployed contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WithImmutables',
      );
      const maliciousContractFolderPath = path.join(
        __dirname,
        'sources',
        'WithImmutablesCreationBytecodeAttack',
      );

      const maliciousArtifact = require(
        path.join(maliciousContractFolderPath, 'artifact.json'),
      );
      const { contractAddress, txHash } = await deployFromAbiAndBytecode(
        signer,
        contractFolderPath,
        ['12345'],
      );

      const checkedContracts = await checkFilesWithMetadataFromContractFolder(
        maliciousContractFolderPath,
      );
      const recompiled = await checkedContracts[0].recompile();
      const match = {
        address: contractAddress,
        chainId: sourcifyChainHardhat.chainId.toString(),
        runtimeMatch: null,
        creationMatch: null,
      };
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);

      const generateCreationCborAuxdataPositions = async () => {
        if (!checkedContracts[0].creationBytecodeCborAuxdata) {
          await checkedContracts[0].generateCborAuxdataPositions();
        }
        return checkedContracts[0].creationBytecodeCborAuxdata || {};
      };
      await matchWithCreationTx(
        match,
        maliciousArtifact.bytecode,
        sourcifyChainHardhat,
        contractAddress,
        txHash,
        recompiledMetadata,
        generateCreationCborAuxdataPositions,
        recompiled.creationLinkReferences,
      );
      expectMatch(match, null, contractAddress, undefined); // status is null
    });

    it('should fail to matchWithCreationTx when passing an abstract contract', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WithImmutables',
      );

      const { contractAddress, txHash: creatorTxHash } =
        await deployFromAbiAndBytecode(signer, contractFolderPath, ['12345']);

      const maliciousContractFolderPath = path.join(
        __dirname,
        'sources',
        'AbstractCreationBytecodeAttack',
      );
      const checkedContracts = await checkFilesWithMetadataFromContractFolder(
        maliciousContractFolderPath,
      );
      const recompiled = await checkedContracts[0].recompile();
      const match = {
        address: contractAddress,
        chainId: sourcifyChainHardhat.chainId.toString(),
        runtimeMatch: null,
        creationMatch: null,
      };
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);

      const generateCreationCborAuxdataPositions = async () => {
        if (!checkedContracts[0].creationBytecodeCborAuxdata) {
          await checkedContracts[0].generateCborAuxdataPositions();
        }
        return checkedContracts[0].creationBytecodeCborAuxdata || {};
      };
      await matchWithCreationTx(
        match,
        recompiled.creationBytecode,
        sourcifyChainHardhat,
        contractAddress,
        creatorTxHash,
        recompiledMetadata,
        generateCreationCborAuxdataPositions,
        recompiled.creationLinkReferences,
      );
      expectMatch(match, null, contractAddress, undefined); // status is null
    });

    it('should successfully verify with matchWithCreationTx with creationTxHash', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WithImmutables',
      );
      const { contractAddress, txHash: creatorTxHash } =
        await deployFromAbiAndBytecode(signer, contractFolderPath, ['12345']);

      const checkedContracts =
        await checkFilesWithMetadataFromContractFolder(contractFolderPath);
      const recompiled = await checkedContracts[0].recompile();
      const match = {
        address: contractAddress,
        chainId: sourcifyChainHardhat.chainId.toString(),
        runtimeMatch: null,
        creationMatch: null,
      };
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);
      const generateCreationCborAuxdataPositions = async () => {
        if (!checkedContracts[0].creationBytecodeCborAuxdata) {
          await checkedContracts[0].generateCborAuxdataPositions();
        }
        return checkedContracts[0].creationBytecodeCborAuxdata || {};
      };
      await matchWithCreationTx(
        match,
        recompiled.creationBytecode,
        sourcifyChainHardhat,
        contractAddress,
        creatorTxHash,
        recompiledMetadata,
        generateCreationCborAuxdataPositions,
        recompiled.creationLinkReferences,
      );
      try {
        expect(match.creationMatch).to.equal('perfect');
        expect(match.address).to.equal(contractAddress);
      } catch (e) {
        console.log('Match: ', match);
        throw e;
      }
    });

    it('find a partial match for a contract with multiple auxdatas and one of the "subcontract" was modified', async () => {
      const contractFolderPath = path.join(
        __dirname,
        'sources',
        'WithMultipleAuxdatas',
      );
      const { contractAddress, txHash: creatorTxHash } =
        await deployFromAbiAndBytecode(signer, contractFolderPath, []);

      const checkedContracts =
        await checkFilesWithMetadataFromContractFolder(contractFolderPath);
      const recompiled = await checkedContracts[0].recompile();
      const match: Match = {
        address: contractAddress,
        chainId: sourcifyChainHardhat.chainId.toString(),
        runtimeMatch: null,
        creationMatch: null,
      };
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);
      const generateCreationCborAuxdataPositions = async () => {
        if (!checkedContracts[0].creationBytecodeCborAuxdata) {
          await checkedContracts[0].generateCborAuxdataPositions();
        }
        return checkedContracts[0].creationBytecodeCborAuxdata || {};
      };
      await matchWithCreationTx(
        match,
        recompiled.creationBytecode,
        sourcifyChainHardhat,
        contractAddress,
        creatorTxHash,
        recompiledMetadata,
        generateCreationCborAuxdataPositions,
        recompiled.creationLinkReferences,
      );
      try {
        expect(match.creationMatch).to.equal('partial');
        expect(match.address).to.equal(contractAddress);
        // expect every creationTransformationValues
        expect(match.creationTransformationValues?.cborAuxdata?.['1']).to.equal(
          '0xa2646970667358221220fe338e4778c1623b5865cd4121849802c8ed68e688def4d95b606f2f02ec563e64736f6c63430008090033',
        );
        expect(match.creationTransformationValues?.cborAuxdata?.['2']).to.equal(
          '0xa2646970667358221220bc654cadfb13b9ef229b6a2db4424f95dc4c52e3ae9b60648aa276f8eb0b3f8464736f6c63430008090033',
        );
        expect(match.creationTransformationValues?.cborAuxdata?.['3']).to.equal(
          '0xa2646970667358221220eb4312065a8c0fb940ef11ef5853554a447a5325095ee0f8fbbbbfc43dbb1b7464736f6c63430008090033',
        );

        // expect every creationTransformations
        expect(match.creationTransformations).to.deep.include({
          type: 'replace',
          reason: 'cborAuxdata',
          offset: 4148,
          id: '1',
        });
        expect(match.creationTransformations).to.deep.include({
          type: 'replace',
          reason: 'cborAuxdata',
          offset: 2775,
          id: '2',
        });
        expect(match.creationTransformations).to.deep.include({
          type: 'replace',
          reason: 'cborAuxdata',
          offset: 4095,
          id: '3',
        });
      } catch (e) {
        console.log('Match: ', match);
        throw e;
      }
    });
  });
});
