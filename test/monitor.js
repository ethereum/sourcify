const MOCK_REPOSITORY = process.env.MOCK_REPOSITORY = "./mockRepository";
process.env.MOCK_DATABASE = "./mockDatabase";
process.env.IPFS_URL = "http://ipfs.io/ipfs/";
const GANACHE_PORT = process.env.LOCALCHAIN_PORT || 8545;

const ganache = require('ganache-cli');
const util = require('util');
const ipfs = require('ipfs');
const rimraf = require('rimraf');
const chai = require('chai');
const Monitor = require("../dist/monitor/monitor").default;
const { deployFromArtifact, waitSecs } = require('./helpers/helpers');
const fs = require("fs");
const path = require("path");
const Web3 = require("web3");

function assertEqualityFromPath(obj1, obj2path) {
    const obj2raw = fs.readFileSync(obj2path).toString();
    const obj2 = JSON.parse(obj2raw);
    chai.expect(obj1, `assertFromPath: ${obj2path}`).to.deep.equal(obj2);
}

function assertFilesStored(chainId, address, metadataIpfsHash, metadata) {
    const pathPrefix = path.join(MOCK_REPOSITORY, 'contracts', 'full_match', chainId, address);
    const addressMetadataPath = path.join(pathPrefix, 'metadata.json');
    const ipfsMetadataPath = path.join(MOCK_REPOSITORY, 'ipfs', metadataIpfsHash);

    assertEqualityFromPath(metadata, addressMetadataPath);
    assertEqualityFromPath(metadata, ipfsMetadataPath);

    for (const sourceName in metadata.sources) {
        const source = metadata.sources[sourceName];
        const sourcePath = path.join(pathPrefix, "sources", sourceName);
        const savedSource = fs.readFileSync(sourcePath).toString();
        const savedSourceHash = Web3.utils.keccak256(savedSource);
        chai.expect(savedSourceHash, "sourceHash comparison").to.equal(source.keccak256);
    }
}

function startMonitor(startBlock) {
    const monitor = new Monitor({ repository: MOCK_REPOSITORY, testing: true });

    chai.expect(monitor.chainMonitors).to.have.a.lengthOf(1);
    const chainId = monitor.chainMonitors[0].chainId;

    if (startBlock !== undefined) {
        process.env[`MONITOR_START_${chainId}`] = startBlock;
    }

    monitor.start();
    return { monitor, chainId };
}

describe("Monitor", function() {
    const ganacheServer = ganache.server({ blockTime: 1 });

    let ipfsNode;

    const contractArtifact = require('./sources/pass/simpleWithImport.js');
    const rawMetadata = contractArtifact.compilerOutput.metadata;
    const metadata = JSON.parse(rawMetadata);
    let metadataIpfsHash;

    const sources = contractArtifact.sourceCodes;

    let web3Provider;

    const deployContract = async (artifact) => {
        const instance = await deployFromArtifact(web3Provider, artifact);
        return instance.options.address;
    }

    before(async function() {
        this.timeout(20 * 1000);

        ipfsNode = await ipfs.create({ offline: true, silent: true });
        metadataIpfsHash = (await ipfsNode.add(rawMetadata)).path;
        for (const sourceName in sources) {
            await ipfsNode.add(sources[sourceName]);
        }

        await util.promisify(ganacheServer.listen)(GANACHE_PORT);
        web3Provider = new Web3(`http://localhost:${GANACHE_PORT}`);
    });

    beforeEach(function() {
        rimraf.sync(MOCK_REPOSITORY);
    });

    it("should sourcify the deployed contract", async function() {
        this.timeout(25 * 1000);

        const { monitor, chainId } = startMonitor();
        const address = await deployContract(contractArtifact);

        await waitSecs(20);
        assertFilesStored(chainId, address, metadataIpfsHash, metadata);

        monitor.stop();
    });

    it("should sourcify the deployed contract after being started with a delay", async function() {
        this.timeout(50 * 1000);

        const currentBlockNumber = await web3Provider.eth.getBlockNumber();
        const address = await deployContract(contractArtifact);

        await waitSecs(10); // to allow for blocks to generate 
        const { monitor, chainId } = startMonitor(currentBlockNumber - 1);

        await waitSecs(30);
        assertFilesStored(chainId, address, metadataIpfsHash, metadata);

        monitor.stop();
    });

    after(async function() {
        await util.promisify(ganacheServer.close)();
        await ipfsNode.stop();
        rimraf.sync(MOCK_REPOSITORY);
    });
});
