const { expect } = require("chai");
const sinon = require("sinon");
const Monitor = require("../dist/Monitor");
const logger = require("../dist/logger");
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

  it("should use default config when no config is provided", function () {
    const loggerSpy = sinon.spy(logger, "warn");

    const _monitor = new Monitor([localChain]);
    expect(
      loggerSpy.calledWith(
        sinon.match(/No config provided, using default config/)
      )
    ).to.be.true;
  });

  // ... (rest of the test cases remain the same)
});
