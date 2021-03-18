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
const ethers = require("ethers");

class Counter {
    static get() {
        return Counter.cnt++;
    }
}
Counter.cnt = 0;

class MonitorWrapper {
    constructor() {
        this.repository = "./mockRepository" + Math.random().toString().slice(2);
        this.monitor = new Monitor({ repository: this.repository, testing: true });
        chai.expect(this.monitor.chainMonitors).to.have.a.lengthOf(1);
        this.chainId = this.monitor.chainMonitors[0].chainId;
    }

    start(startBlock) {
        const envVar = `MONITOR_START_${this.chainId}`;
        this.envVarStash = process.env[envVar];
        if (startBlock !== undefined) {
            process.env[envVar] = startBlock;
        }
        this.monitor.start();
    }

    stop() {
        const envVar = `MONITOR_START_${this.chainId}`;
        delete process.env[envVar];
        if (this.envVarStash) {
            process.env[envVar] = this.envVarStash;
        }
        this.monitor.stop();
        rimraf.sync(this.repository);
    }

    getPathPrefix(address) {
        return path.join(this.repository, "contracts", "full_match", this.chainId, address);
    }

    getAddressMetadataPath(address) {
        const pathPrefix = this.getPathPrefix(address);
        return path.join(pathPrefix, "metadata.json");
    }

    assertFilesNotStored(address, contractWrapper, metadataMtime) {
        const addressMetadataPath = this.getAddressMetadataPath(address);
        assertEqualityFromPath(contractWrapper.metadata, addressMetadataPath, metadataMtime);
    }

    assertFilesStored(address, contractWrapper) {
        console.log(`Started assertions for ${address}`);
        const pathPrefix = this.getPathPrefix(address);
        const addressMetadataPath = this.getAddressMetadataPath(address);
        const ipfsMetadataPath = path.join(this.repository, "ipfs", contractWrapper.metadataIpfsHash);
    
        const metadata = contractWrapper.metadata;
        assertEqualityFromPath(metadata, addressMetadataPath);
        assertEqualityFromPath(metadata, ipfsMetadataPath);
    
        for (const sourceName in metadata.sources) {
            const source = metadata.sources[sourceName];
            const sourcePath = path.join(pathPrefix, "sources", sourceName);
            const savedSource = fs.readFileSync(sourcePath).toString();
            const savedSourceHash = Web3.utils.keccak256(savedSource);
            const originalSourceHash = source.keccak256 || Web3.utils.keccak256(source.content);
            chai.expect(savedSourceHash, "sourceHash comparison").to.equal(originalSourceHash);
        }
    }

    writeMetadata(address, metadata) {
        const addressMetadataPath = this.getAddressMetadataPath(address);
        fs.mkdirSync(path.dirname(addressMetadataPath), { recursive: true });
        fs.writeFileSync(addressMetadataPath, metadata);
        return fs.statSync(addressMetadataPath).birthtime;
    }
}

function assertEqualityFromPath(obj1, obj2path, expectedMtime) {
    const obj2raw = fs.readFileSync(obj2path).toString();
    const obj2 = JSON.parse(obj2raw);
    chai.expect(obj1, `assertFromPath: ${obj2path}`).to.deep.equal(obj2);
    if (expectedMtime) {
        const actualMtime = fs.statSync(obj2path).mtime;
        chai.expect(actualMtime).to.deep.equal(expectedMtime);
    }
}

class ContractWrapper {
    constructor(jsPath, publishOptions, args=[]) {
        this.artifact = require(jsPath);
        this.rawMetadata = this.artifact.compilerOutput.metadata;
        this.metadata = JSON.parse(this.rawMetadata);
        this.sources = this.artifact.sourceCodes;
        this.publishOptions = publishOptions;
        this.args = args;
    }

    async publish(ipfsNode) {
        if (this.publishOptions.metadata) {
            this.metadataIpfsHash = (await ipfsNode.add(this.rawMetadata)).path;
        }

        if (this.publishOptions.sources) {
            for (const sourceName in this.sources) {
                await ipfsNode.add(this.sources[sourceName]);
            }
        }
    }
}

describe("Monitor", function() {
    this.timeout(60 * 1000);
    const ganacheServer = ganache.server({ blockTime: 1, total_accounts: 5 });

    const contractWrappers = {
        simpleWithImport: new ContractWrapper("./sources/pass/simpleWithImport.js", { metadata: true, sources: true }),
        simpleLiteral: new ContractWrapper("./sources/pass/simple.literal.js", { metadata: true }),
        withImmutables: new ContractWrapper("./sources/pass/withImmutables.js", { metadata: true, sources: true }, [2])
    };

    let ipfsNode;
    let web3Provider;
    let accounts;

    const deployContract = async (contractWrapper, from) => {
        const instance = await deployFromArtifact(web3Provider, contractWrapper.artifact, from, contractWrapper.args);
        console.log("Deployed contract at", instance.options.address);
        return instance.options.address;
    }

    before(async function() {
        ipfsNode = await ipfs.create({ offline: true, silent: true });
        console.log("Initialized ipfs test node");

        for (const contractName in contractWrappers) {
            await contractWrappers[contractName].publish(ipfsNode);
        }

        await util.promisify(ganacheServer.listen)(GANACHE_PORT);
        console.log("Started ganache local server");

        web3Provider = new Web3(`http://localhost:${GANACHE_PORT}`);
        accounts = await web3Provider.eth.getAccounts();
        console.log("Initialized web3 provider");
    });

    const MONITOR_SECS = 25; // waiting for monitor to do its job 
    const GENERATION_SECS = 10; // waiting for extra blocks to be generated
    const CATCH_UP_SECS = 10; // waiting for a delayed monitor to catch up

    const sourcifyContract = async (contractWrapper) => {
        const monitorWrapper = new MonitorWrapper();
        monitorWrapper.start();
        const address = await deployContract(contractWrapper, accounts[Counter.get()]);

        await waitSecs(MONITOR_SECS);
        monitorWrapper.assertFilesStored(address, contractWrapper);
        monitorWrapper.stop();
    }

    it("should sourcify the deployed contract", async function() {
        await sourcifyContract(contractWrappers.simpleWithImport);
    });

    it("should sourcify if metadata provides only literal content", async function() {
        await sourcifyContract(contractWrappers.simpleLiteral);
    });

    it("should not resourcify if already sourcified", async function() {
        const monitorWrapper = new MonitorWrapper();
        const from = accounts[Counter.get()];
        const calculatedAddress = ethers.utils.getContractAddress({ from, nonce: 0 });
        const metadataBirthtime = monitorWrapper.writeMetadata(calculatedAddress, contractWrappers.simpleWithImport.rawMetadata);

        monitorWrapper.start();
        const deployedAddress = await deployContract(contractWrappers.simpleWithImport, from);
        chai.expect(calculatedAddress).to.deep.equal(deployedAddress);

        await waitSecs(MONITOR_SECS);
        monitorWrapper.assertFilesNotStored(deployedAddress, contractWrappers.simpleWithImport, metadataBirthtime);
        monitorWrapper.stop();
    });

    it("should sourcify the deployed contract after being started with a delay", async function() {
        const currentBlockNumber = await web3Provider.eth.getBlockNumber();
        const address = await deployContract(contractWrappers.simpleWithImport, accounts[Counter.get()]);

        await waitSecs(GENERATION_SECS);

        const monitorWrapper = new MonitorWrapper();
        monitorWrapper.start(currentBlockNumber - 1);

        await waitSecs(CATCH_UP_SECS + MONITOR_SECS);
        monitorWrapper.assertFilesStored(address, contractWrappers.simpleWithImport);
        monitorWrapper.stop();
    });

    it("should sourcify a contract with immutables", async function() {
        await sourcifyContract(contractWrappers.withImmutables);
    });

    after(async function() {
        await util.promisify(ganacheServer.close)();
        await ipfsNode.stop();
    });
});
