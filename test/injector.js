process.env.MOCK_REPOSITORY = './mockRepository';
process.env.MOCK_DATABASE = './mockDatabase';

const assert = require('assert');
const ganache = require('ganache-cli');
const exec = require('child_process').execSync;
const pify = require('pify');
const Web3 = require('web3');
const path = require('path');
const read = require('fs').readFileSync;

const Simple = require('./sources/pass/simple.js');
const SimpleWithImport = require('./sources/pass/simpleWithImport');
const MismatchedBytecode = require('./sources/fail/wrongCompiler');
const Literal = require('./sources/pass/simple.literal');
const SimpleBzzr0 = require('./sources/pass/simple.bzzr0');
const SimpleBzzr1 = require('./sources/pass/simple.bzzr1');

const {
    deployFromArtifact,
    getIPFSHash,
    getBzzr0Hash,
    getBzzr1Hash
} = require('./helpers/helpers');

const Injector = require('../src/server/services/Injector').default;
const getChainId = require('../src/utils/Utils').getChainId;

describe('injector', function () {
    describe('inject', function () {
        this.timeout(100000);

        let server;
        let port = 8545;
        let injector = new Injector({ localChainUrl: process.env.LOCALCHAIN_URL, silent: true });;
        let chainId = injector.fileService.getChainId('localhost');
        let chain = 'localhost';
        let mockRepo = 'mockRepository';
        let web3;
        let simpleInstance;
        let simpleWithImportInstance;
        let literalInstance;

        const simpleSource = Simple.sourceCodes["Simple.sol"];
        const simpleWithImportSource = SimpleWithImport.sourceCodes["SimpleWithImport.sol"];
        const importSource = SimpleWithImport.sourceCodes["Import.sol"];
        const simpleMetadata = Simple.compilerOutput.metadata;
        const simpleWithImportMetadata = SimpleWithImport.compilerOutput.metadata;
        const literalMetadata = Literal.compilerOutput.metadata;

        before(async function () {
            server = ganache.server({ chainId: chainId });
            await pify(server.listen)(port);
            web3 = new Web3(`http://${chain}:${port}`);
        })

        beforeEach(async function () {
            simpleInstance = await deployFromArtifact(web3, Simple);
            simpleWithImportInstance = await deployFromArtifact(web3, SimpleWithImport);
            literalInstance = await deployFromArtifact(web3, Literal);
        })

        beforeEach(async function () {
            simpleInstance = await deployFromArtifact(web3, Simple);
            simpleWithImportInstance = await deployFromArtifact(web3, SimpleWithImport);
            literalInstance = await deployFromArtifact(web3, Literal);
        })

        beforeEach(async function () {
            simpleInstance = await deployFromArtifact(web3, Simple);
            simpleWithImportInstance = await deployFromArtifact(web3, SimpleWithImport);
            literalInstance = await deployFromArtifact(web3, Literal);
        })

        // Clean up repository
        afterEach(function () {
            try { exec(`rm -rf ${mockRepo}`) } catch (err) { /*ignore*/ }
        })

        // Clean up server
        after(async function () {
            await pify(server.close)();
        });

        it('verifies sources from multiple metadatas, addresses & stores by IPFS hash', async function () {
            // Inject by address into repository after recompiling
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [
                    simpleInstance.options.address,
                    simpleWithImportInstance.options.address
                ],
                files: [
                    simpleSource,
                    simpleWithImportSource,
                    importSource,
                    simpleMetadata,
                    simpleWithImportMetadata
                ]
            };

            await injector.inject(inputData);

            // Verify metadata was stored to repository, indexed by ipfs hash
            const simpleHash = await getIPFSHash(simpleMetadata);
            const simpleWithImportHash = await getIPFSHash(simpleWithImportMetadata);

            const simpleSavedMetadata = read(`${mockRepo}/ipfs/${simpleHash}`, 'utf-8');
            const simpleWithImportSavedMetadata = read(`${mockRepo}/ipfs/${simpleWithImportHash}`, 'utf-8');

            assert.equal(simpleSavedMetadata, simpleMetadata);
            assert.equal(simpleWithImportSavedMetadata, simpleWithImportMetadata);
        });

        it('verfies a metadata with embedded source code (--metadata-literal)', async function () {
            // Inject by address into repository after recompiling
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [literalInstance.options.address],
                files: [literalMetadata]
            };

            await injector.inject(inputData);

            // Verify metadata was stored to repository, indexed by ipfs hash
            const literalHash = await getIPFSHash(literalMetadata);
            const literalSavedMetadata = read(`${mockRepo}/ipfs/${literalHash}`, 'utf-8');

            assert.equal(literalSavedMetadata, literalMetadata);
        });

        it('verfies a contract with a bzzr0 hash', async function () {
            const instance = await deployFromArtifact(web3, SimpleBzzr0);
            const metadata = SimpleBzzr0.compilerOutput.metadata;
            const source = SimpleBzzr0.sourceCodes["Simple.sol"];

            // Inject by address into repository after recompiling
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [instance.options.address],
                files: [
                    metadata,
                    source
                ]
            };

            await injector.inject(inputData);

            // Verify metadata was stored to repository, indexed by ipfs hash
            const hash = getBzzr0Hash(SimpleBzzr0);
            const savedMetadata = read(`${mockRepo}/swarm/bzzr0/${hash}`, 'utf-8');

            assert.equal(savedMetadata, metadata);
        });

        it('verfies a contract with a bzzr1 hash', async function () {
            const instance = await deployFromArtifact(web3, SimpleBzzr1);
            const metadata = SimpleBzzr1.compilerOutput.metadata;
            const source = SimpleBzzr1.sourceCodes["Simple.sol"];

            // Inject by address into repository after recompiling
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [instance.options.address],
                files: [
                    metadata,
                    source
                ]
            };

            await injector.inject(inputData);

            // Verify metadata was stored to repository, indexed by ipfs hash
            const hash = getBzzr1Hash(SimpleBzzr1);
            const savedMetadata = read(`${mockRepo}/swarm/bzzr1/${hash}`, 'utf-8');

            assert.equal(savedMetadata, metadata);
        });

        it('verifies a contract when deployed & compiled metadata hashes do not match', async function () {
            const mismatchedMetadata = MismatchedBytecode.compilerOutput.metadata;

            assert.notEqual(
                simpleMetadata,
                mismatchedMetadata
            );

            // Inject Simple with a metadata that specifies solc 0.6.1 instead of 0.6.0
            // Functional bytecode of both contracts is identical but metadata hashes will be different.
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [simpleInstance.options.address],
                files: [
                    simpleSource,
                    mismatchedMetadata
                ]
            };

            await injector.inject(inputData);

            // Verify metadata was saved, indexed by address under partial_match
            const expectedPath = path.join(
                mockRepo,
                'contracts',
                'partial_match',
                chainId.toString(),
                simpleInstance.options.address,
                '/metadata.json'
            );

            const savedMetadata = read(expectedPath, 'utf-8');
            assert.equal(savedMetadata, mismatchedMetadata);

            // // Check symlink also
            // const outputIdMetadata = path.join(
            //   mockRepo,
            //   'partial_match',
            //   this.getIdFromChainName(chain).toString(),
            //   simpleInstance.options.address,
            //   '/metadata.json'
            // );

            // assert.equal(outputIdMetadata, mismatchedMetadata);
        })

        it('errors if metadata is missing', async function () {
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [simpleInstance.options.address],
                files: [simpleSource]
            }

            try {
                await injector.inject(inputData);
            } catch (err) {
                assert.equal(
                    err.message,
                    'Metadata file not found. Did you include "metadata.json"?'
                );
            }
        });

        it('errors if sources specified in metadata are missing', async function () {
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [simpleInstance.options.address],
                files: [simpleMetadata]
            }

            try {
                await injector.inject(inputData);
            } catch (err) {
                assert(err.message.includes('Simple.sol'));
                assert(err.message.includes('cannot be found'));
            }
        });

        it('errors when recompiled bytecode does not match deployed', async function () {
            const inputData = {
                repository: mockRepo,
                chain: chainId,
                addresses: [simpleWithImportInstance.options.address],
                files: [simpleMetadata, simpleSource]
            }

            // Try to match Simple sources/metadata to SimpleWithImport's address
            try {
                await injector.inject(inputData);
            } catch (err) {
                assert(err.message.includes('Could not match on-chain deployed bytecode'));
                assert(err.message.includes('contracts/Simple.sol'));
            }
        });
    });
})
