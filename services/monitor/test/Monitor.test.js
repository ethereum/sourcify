const { expect } = require("chai");
const sinon = require("sinon");
const Monitor = require("../dist/Monitor").default;
const logger = require("../dist/logger").default;
const ganache = require("ganache");
const { JsonRpcProvider, JsonRpcSigner, Network } = require("ethers");
const {
  deployFromAbiAndBytecode,
  nockInterceptorForVerification,
} = require("./helpers");
const testLogger = require("./testLogger");

const GANACHE_PORT = 8545;
const GANACHE_BLOCK_TIME_IN_SEC = 3;
const MOCK_SOURCIFY_SERVER = "http://mocksourcifyserver.dev/server/";
const localChain = {
  chainId: 1337,
  rpc: [`http://localhost:${GANACHE_PORT}`],
  name: "Localhost Ganache",
};

describe("Monitor", function () {
  this.timeout(30000);

  let sandbox;
  let ganacheServer;
  let signer;
  let account;
  let monitor;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();

    ganacheServer = ganache.server({
      wallet: { totalAccounts: 5 },
      chain: { chainId: 1337, networkId: 1337 },
      miner: { blockTime: GANACHE_BLOCK_TIME_IN_SEC },
    });
    await ganacheServer.listen(GANACHE_PORT);
    testLogger.info("Started ganache local server at port " + GANACHE_PORT);
    const ethersNetwork = new Network(localChain.rpc[0], localChain.chainId);
    signer = await new JsonRpcProvider(
      `http://localhost:${GANACHE_PORT}`,
      ethersNetwork,
      { staticNetwork: ethersNetwork }
    ).getSigner();
    signer.provider.on("block", (blockNumber) => {
      testLogger.info("New block mined: " + blockNumber);
    });
    account = await signer.getAddress();
    testLogger.info("Initialized provider with signer account " + account);
  });

  afterEach(async function () {
    await ganacheServer.close();
    if (monitor) monitor.stop();
    sandbox.restore();
  });

  it("should use default config when no config is provided", () => {
    const loggerSpy = sinon.spy(logger, "warn");
    const _monitor = new Monitor([localChain]);
    expect(
      loggerSpy.calledWith(
        sinon.match(/No config provided, using default config/)
      )
    ).to.be.true;
  });

  it("should throw an error if no chains are provided", () => {
    expect(() => new Monitor([])).to.throw("No chains to monitor");
  });

  it("should throw an error if there are chainConfigs for chains not being monitored", () => {
    expect(
      () =>
        new Monitor([localChain], {
          chainConfigs: {
            2: {},
          },
        })
    ).to.throw(
      "Chain configs found for chains that are not being monitored: 2"
    );
  });

  it("should successfully catch a deployed contract, assemble, and send to Sourcify", async () => {
    monitor = new Monitor([localChain], {
      sourcifyServerURLs: [MOCK_SOURCIFY_SERVER],
      chainConfigs: {
        [localChain.chainId]: {
          startBlock: 0,
          blockInterval: GANACHE_BLOCK_TIME_IN_SEC * 1000,
        },
      },
    });

    const contractAddress = await deployFromAbiAndBytecode(
      signer,
      require("./sources/Storage/1_Storage.json").abi,
      require("./sources/Storage/1_Storage.json").bytecode,
      []
    );

    // Set up a nock interceptor to intercept the request to MOCK_SOURCIFY_SERVER url.
    const nockInterceptor = nockInterceptorForVerification(
      MOCK_SOURCIFY_SERVER,
      localChain.chainId,
      contractAddress
    );

    // start monitor after contract is deployed to avoid sending request before setting up interceptor
    // Need to know the contract address to set up the interceptor
    await monitor.start();
    // wait 30 seconds
    await new Promise((resolve) =>
      setTimeout(resolve, 3 * GANACHE_BLOCK_TIME_IN_SEC * 1000)
    );

    expect(
      nockInterceptor.isDone(),
      `Server ${MOCK_SOURCIFY_SERVER} not called`
    ).to.be.true;
  });
  // Add more test cases as needed
});
