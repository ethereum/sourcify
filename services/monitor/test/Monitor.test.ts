import { expect } from "chai";
import sinon from "sinon";
// import { EventEmitter } from "stream";
import Monitor from "../src/Monitor";
// import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import ChainMonitor from "../src/ChainMonitor";
// import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";
import logger from "../src/logger";
import ganache, { Server } from "ganache";
import { JsonRpcProvider, JsonRpcSigner, Network } from "ethers";
import { deployFromAbiAndBytecode } from "./helpers";
// Use nock because sinon can only intercept XMLHttpRequests, which nodejs does not use
import nock from "nock";

const GANACHE_PORT = 8545;
const FAKE_SOURCIFY_URL = "http://fakesourcifyserver.dev/server/";

const localChain = {
  chainId: 1337,
  rpc: [`http://localhost:${GANACHE_PORT}`],
  name: "Localhost Ganache",
};

describe("Monitor", function () {
  this.timeout(30000);

  let sandbox: sinon.SinonSandbox;
  let ganacheServer: Server;
  let signer: JsonRpcSigner;
  let account: string;

  nock(FAKE_SOURCIFY_URL)
    .post("/")
    .reply(function (uri, requestBody: any) {
      console.log("Received request to Sourcify server: \n " + requestBody);");
      const { address, chainId } = requestBody;
      return [200, { address, chainId, status: "perfect" }];
    });

  before(async () => {
    ganacheServer = ganache.server({
      wallet: { totalAccounts: 5 },
      chain: { chainId: 1337, networkId: 1337 },
    });
    await ganacheServer.listen(GANACHE_PORT);
    console.log("Started ganache local server at port " + GANACHE_PORT);
    const ethersNetwork = new Network(localChain.rpc[0], localChain.chainId);
    signer = await new JsonRpcProvider(
      `http://localhost:${GANACHE_PORT}`,
      ethersNetwork,
      { staticNetwork: ethersNetwork }
    ).getSigner();
    account = await signer.getAddress();
    console.log("Initialized provider with signer account " + account);
  });

  after(() => {
    ganacheServer.close();
    console.log("Stopped ganache local server");
  });
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
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

  it("should initialize ChainMonitors and start monitoring", async () => {
    const chainMonitorStub = sandbox
      .stub(ChainMonitor.prototype, "start")
      .resolves();
    const monitor = new Monitor([localChain]);
    await monitor.start();
    expect(chainMonitorStub.called).to.be.true;
  });

  it.only("should successfully catch a deployed contract, assemble, and send to Sourcify", async () => {
    const monitor = new Monitor([localChain], {
      sourcifyServerURLs: [FAKE_SOURCIFY_URL],
    });
    monitor.start();

    const contractAddress = await deployFromAbiAndBytecode(
      signer,
      (
        await import("./sources/Storage/1_Storage.json")
      ).abi,
      (
        await import("./sources/Storage/1_Storage.json")
      ).bytecode,
      []
    );

    // wait 30 seconds
    await new Promise((resolve) => setTimeout(resolve, 30000));
  });
  // Add more test cases as needed
});
