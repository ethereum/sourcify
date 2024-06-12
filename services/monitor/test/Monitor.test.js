const { expect } = require("chai");
const sinon = require("sinon");
const Monitor = require("../dist/Monitor").default;
const logger = require("../dist/logger").default;
const { JsonRpcProvider, Network } = require("ethers");
const {
  deployFromAbiAndBytecode,
  nockInterceptorForVerification,
} = require("./helpers");
const testLogger = require("./testLogger");
const {
  startHardhatNetwork,
  stopHardhatNetwork,
} = require("./hardhat-network-helper");

const HARDHAT_PORT = 8546;
// Configured in hardhat.config.js
const HARDHAT_BLOCK_TIME_IN_SEC = 3;
const MOCK_SOURCIFY_SERVER = "http://mocksourcifyserver.dev/server/";
const localChain = {
  chainId: 1337,
  rpc: [`http://localhost:${HARDHAT_PORT}`],
  name: "Localhost Hardhat Network",
};

describe("Monitor", function () {
  this.timeout(30000);

  let sandbox;
  let hardhatNodeProcess;
  let signer;
  let account;
  let monitor;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();

    hardhatNodeProcess = await startHardhatNetwork(HARDHAT_PORT);
    testLogger.info("Started hardhat node at port " + HARDHAT_PORT);
    const ethersNetwork = new Network(localChain.rpc[0], localChain.chainId);
    signer = await new JsonRpcProvider(
      `http://localhost:${HARDHAT_PORT}`,
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
    await stopHardhatNetwork(hardhatNodeProcess);
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
          blockInterval: HARDHAT_BLOCK_TIME_IN_SEC * 1000,
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
      setTimeout(resolve, 3 * HARDHAT_BLOCK_TIME_IN_SEC * 1000)
    );

    expect(
      nockInterceptor.isDone(),
      `Server ${MOCK_SOURCIFY_SERVER} not called`
    ).to.be.true;
  });
  // Add more test cases as needed
});
