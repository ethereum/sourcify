process.env.MOCK_REPOSITORY = "./mockRepository";
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

class MonitorWrapper {
    constructor() {
        this.repository = "./mockRepository" + Math.random().toString().slice(2);
        this.monitor = new Monitor({ repository: this.repository, testing: true });
        chai.expect(this.monitor.chainMonitors).to.have.a.lengthOf(1);
        this.chainId = this.monitor.chainMonitors[0].chainId;
    }

    start(startBlock) {
        if (startBlock !== undefined) {
            process.env[`MONITOR_START_${this.chainId}`] = startBlock;
        }
        this.monitor.start();
    }

    stop() {
        this.monitor.stop();
        rimraf.sync(this.repository);
    }

    assertFilesStored(address, metadataIpfsHash, metadata) {
        console.log(`Started assertions for ${address}`);
        const pathPrefix = path.join(this.repository, 'contracts', 'full_match', this.chainId, address);
        const addressMetadataPath = path.join(pathPrefix, 'metadata.json');
        const ipfsMetadataPath = path.join(this.repository, 'ipfs', metadataIpfsHash);
    
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
}

function assertEqualityFromPath(obj1, obj2path) {
    const obj2raw = fs.readFileSync(obj2path).toString();
    const obj2 = JSON.parse(obj2raw);
    chai.expect(obj1, `assertFromPath: ${obj2path}`).to.deep.equal(obj2);
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
        console.log("Deployed contract at", instance.options.address);
        return instance.options.address;
    }

    before(async function() {
        this.timeout(20 * 1000);

        ipfsNode = await ipfs.create({ offline: true, silent: true });
        console.log("Initialized ipfs test node");

        metadataIpfsHash = (await ipfsNode.add(rawMetadata)).path;
        for (const sourceName in sources) {
            await ipfsNode.add(sources[sourceName]);
        }
        console.log("Published files to ipfs");

        await util.promisify(ganacheServer.listen)(GANACHE_PORT);
        console.log("Started ganache local server");

        web3Provider = new Web3(`http://localhost:${GANACHE_PORT}`);
        console.log("Initialized web3 provider");
    });

    const EXTRA_SECS = 10; // extra time that allows latency in execution

    it("should sourcify the deployed contract", async function() {
        const MONITOR_SECS = 25; // how long to wait for monitor to do its job
        this.timeout((MONITOR_SECS + EXTRA_SECS) * 1000);

        const monitorWrapper = new MonitorWrapper();
        monitorWrapper.start();
        const address = await deployContract(contractArtifact);

        await waitSecs(MONITOR_SECS);
        monitorWrapper.assertFilesStored(address, metadataIpfsHash, metadata);
        monitorWrapper.stop();
    });

    it("should sourcify the deployed contract after being started with a delay", async function() {
        const GENERATION_SECS = 10; // how long to wait for extra blocks to be generated
        const MONITOR_SECS = 35;
        this.timeout((GENERATION_SECS + MONITOR_SECS + EXTRA_SECS) * 1000);

        const currentBlockNumber = await web3Provider.eth.getBlockNumber();
        const address = await deployContract(contractArtifact);

        await waitSecs(GENERATION_SECS);
        const monitorWrapper = new MonitorWrapper();
        monitorWrapper.start(currentBlockNumber - 1);

        await waitSecs(MONITOR_SECS);
        monitorWrapper.assertFilesStored(address, metadataIpfsHash, metadata);
        monitorWrapper.stop();
    });

    after(async function() {
        await util.promisify(ganacheServer.close)();
        await ipfsNode.stop();
    });
});
