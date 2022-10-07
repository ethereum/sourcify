process.env.TESTING = "true";
process.env.MOCK_REPOSITORY = "./mockRepository";
process.env.IPFS_GATEWAY = "http://ipfs.io/ipfs/";
const GANACHE_PORT = 8545;
const ContractWrapper = require("./helpers/ContractWrapper");
const ganache = require("ganache");
const ipfs = require("ipfs-core");
const rimraf = require("rimraf");
const chai = require("chai");
const Monitor = require("../dist/monitor/monitor").default;
const { waitSecs } = require("./helpers/helpers");
const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const ethers = require("ethers");
const { EventEmitter } = require("stream");

class Counter {
  static get() {
    return Counter.cnt++;
  }
}
Counter.cnt = 0;

class MonitorWrapper extends EventEmitter {
  constructor() {
    super();
    this.repository = "./mockRepository" + Math.random().toString().slice(2);
    this.monitor = new Monitor({ repository: this.repository, testing: true });
    this.monitor.on("contract-verified-successfully", (chainId, address) => {
      this.emit("contract-verified-successfully", chainId, address);
    });
    this.monitor.on("contract-already-verified", (chainId, address) => {
      this.emit("contract-already-verified", chainId, address);
    });
    chai.expect(this.monitor.chainMonitors).to.have.a.lengthOf(1); // Number of chains in TEST_CHAINS at services/core/utils/utils.ts
    this.chainId = this.monitor.chainMonitors[0].chainId;
  }

  async start(startBlock) {
    const envVar = `MONITOR_START_${this.chainId}`;
    this.envVarStash = process.env[envVar];
    if (startBlock !== undefined) {
      process.env[envVar] = startBlock;
    }
    await this.monitor.start();
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
    return path.join(
      this.repository,
      "contracts",
      "full_match",
      this.chainId,
      address
    );
  }

  getAddressMetadataPath(address) {
    const pathPrefix = this.getPathPrefix(address);
    return path.join(pathPrefix, "metadata.json");
  }

  getConstructorArgsPath(address) {
    const pathPrefix = this.getPathPrefix(address);
    return path.join(pathPrefix, "constructor-args.txt");
  }

  assertFilesNotStored(address, contractWrapper, expectedMtime) {
    const addressMetadataPath = this.getAddressMetadataPath(address);
    assertEqualityFromPath(contractWrapper.metadata, addressMetadataPath, {
      expectedMtime,
      isJson: true,
    });
  }

  assertFilesStored(address, contractWrapper) {
    console.log(`Started assertions for ${address}`);
    const pathPrefix = this.getPathPrefix(address);
    const addressMetadataPath = this.getAddressMetadataPath(address);

    const metadata = contractWrapper.metadata;
    assertEqualityFromPath(metadata, addressMetadataPath, { isJson: true });

    if (contractWrapper.argsHex) {
      const constructorArgsPath = this.getConstructorArgsPath(address);
      assertEqualityFromPath(contractWrapper.argsHex, constructorArgsPath);
    }

    for (const sourceName in metadata.sources) {
      const source = metadata.sources[sourceName];
      const sourcePath = path.join(pathPrefix, "sources", sourceName);
      const savedSource = fs.readFileSync(sourcePath).toString();
      const savedSourceHash = Web3.utils.keccak256(savedSource);
      const originalSourceHash =
        source.keccak256 || Web3.utils.keccak256(source.content);
      chai
        .expect(savedSourceHash, "sourceHash comparison")
        .to.equal(originalSourceHash);
    }
  }

  /**
   * Used for writing (dummy) metadata independent of monitor's work.
   * @param {string} address
   * @param {*} metadata
   * @returns ctime of written metadata
   */
  writeMetadata(address, metadata) {
    const addressMetadataPath = this.getAddressMetadataPath(address);
    fs.mkdirSync(path.dirname(addressMetadataPath), { recursive: true });
    fs.writeFileSync(addressMetadataPath, metadata);
    return fs.statSync(addressMetadataPath).ctime;
  }
}

function assertEqualityFromPath(obj1, obj2path, options = {}) {
  const obj2raw = fs.readFileSync(obj2path).toString();
  const obj2 = options.isJson ? JSON.parse(obj2raw) : obj2raw;
  chai.expect(obj1, `assertFromPath: ${obj2path}`).to.deep.equal(obj2);
  if (options.expectedMtime) {
    const actualMtime = fs.statSync(obj2path).mtime;
    chai.expect(actualMtime).to.deep.equal(options.expectedMtime);
  }
}

describe("Monitor", function () {
  this.timeout(60 * 1000);
  let ganacheServer;

  const contractWrappers = {
    simpleWithImport: new ContractWrapper(
      require("./sources/pass/simpleWithImport.js"),
      { metadata: true, sources: true }
    ),
    simpleLiteral: new ContractWrapper(
      require("./sources/pass/simple.literal.js"),
      {
        metadata: true,
      }
    ),
    withImmutables: new ContractWrapper(
      require("./sources/pass/withImmutables.js"),
      { metadata: true, sources: true },
      [2]
    ),
    withoutMetadataHash: new ContractWrapper(
      require("./sources/pass/withoutMetadataHash.js"),
      { metadata: true, sources: true }
    ),
  };

  let ipfsNode;
  let web3Provider;
  let accounts;

  before(async function () {
    ipfsNode = await ipfs.create({ offline: true, silent: true });
    console.log("Initialized ipfs test node");

    for (const contractName in contractWrappers) {
      await contractWrappers[contractName].publish(ipfsNode);
    }
  });

  beforeEach(async () => {
    ganacheServer = ganache.server({
      wallet: { totalAccounts: 5 },
      chain: { chainId: 0, networkId: 0 },
    });
    await ganacheServer.listen(GANACHE_PORT);
    console.log("Started ganache local server at port " + GANACHE_PORT);

    web3Provider = new Web3(`http://localhost:${GANACHE_PORT}`);
    accounts = await web3Provider.eth.getAccounts();
    console.log("Initialized web3 provider");
  });

  afterEach(async () => {
    await ganacheServer.close();
    ganacheServer = null;
    web3Provider = null;
    accounts = null;
  });

  const GENERATION_SECS = 10; // waiting for extra blocks to be generated

  const sourcifyContract = (contractWrapper, done) => {
    const monitorWrapper = new MonitorWrapper();
    monitorWrapper.start().then(() => {
      let address;

      monitorWrapper.on("contract-verified-successfully", () => {
        monitorWrapper.assertFilesStored(address, contractWrapper);
        monitorWrapper.stop();
        done();
      });

      contractWrapper
        .deploy(web3Provider, accounts[Counter.get()])
        .then((addr) => (address = addr));
    });
  };

  it("should sourcify the deployed contract", function (done) {
    sourcifyContract(contractWrappers.simpleWithImport, done);
  });

  it("should sourcify if metadata provides only literal content", function (done) {
    sourcifyContract(contractWrappers.simpleLiteral, done);
  });

  it("should sourcify a contract with immutables", function (done) {
    sourcifyContract(contractWrappers.withImmutables, done);
  });

  it("should not resourcify if already sourcified", function (done) {
    const contract = contractWrappers.simpleWithImport;
    const monitorWrapper = new MonitorWrapper();
    const from = accounts[Counter.get()];
    const calculatedAddress = ethers.utils.getContractAddress({
      from,
      nonce: 0,
    });
    const metadataBirthtime = monitorWrapper.writeMetadata(
      calculatedAddress,
      contract.rawMetadata
    );

    monitorWrapper.start().then(() => {
      let deployedAddress;

      monitorWrapper.on("contract-already-verified", () => {
        monitorWrapper.assertFilesNotStored(
          deployedAddress,
          contract,
          metadataBirthtime
        );
        monitorWrapper.stop();
        done();
      });
      contract.deploy(web3Provider, from).then((addr) => {
        deployedAddress = addr;
        chai.expect(calculatedAddress).to.deep.equal(deployedAddress);
      });
    });
  });

  it("should sourcify the deployed contract after being started with a delay", function (done) {
    const contract = contractWrappers.simpleWithImport;
    contract.deploy(web3Provider, accounts[Counter.get()]).then((address) => {
      web3Provider.eth.getBlockNumber().then((currentBlockNumber) => {
        waitSecs(GENERATION_SECS).then(() => {
          const monitorWrapper = new MonitorWrapper();
          monitorWrapper.start(currentBlockNumber - 1).then(() => {
            monitorWrapper.on("contract-verified-successfully", () => {
              monitorWrapper.assertFilesStored(address, contract);
              monitorWrapper.stop();
              done();
            });
          });
        });
      });
    });
  });

  after(async function () {
    await ipfsNode.stop();
  });
});
