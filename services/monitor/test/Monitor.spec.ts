import { expect } from "chai";
import sinon, { SinonSandbox } from "sinon";
import Monitor from "../src/Monitor";
import logger from "../src/logger";
import { JsonRpcProvider, JsonRpcSigner, Network } from "ethers";
import {
  deployFromAbiAndBytecode,
  nockInterceptorForVerification,
} from "./helpers";
import { logger as testLogger } from "./testLogger";
import {
  startHardhatNetwork,
  stopHardhatNetwork,
} from "./hardhat-network-helper";
import { ChildProcess } from "child_process";
import storageContractArtifact from "./sources/Storage/1_Storage.json";
import nock from "nock";

const HARDHAT_PORT = 8546;
// Configured in hardhat.config.js
const HARDHAT_BLOCK_TIME_IN_SEC = 3;
const MOCK_SOURCIFY_SERVER = "http://mocksourcifyserver.dev/server/";
const MOCK_SOURCIFY_SERVER_RETURNING_ERRORS =
  "http://mocksourcifyserver-returning-errors.dev/server/";
const localChain = {
  chainId: 1337,
  rpc: [`http://localhost:${HARDHAT_PORT}`],
  name: "Localhost Hardhat Network",
};

describe("Monitor", function () {
  let sandbox: SinonSandbox;
  let hardhatNodeProcess: ChildProcess;
  let signer: JsonRpcSigner;
  let account: string;
  let monitor: Monitor;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();

    hardhatNodeProcess = await startHardhatNetwork(HARDHAT_PORT);
    testLogger.info("Started hardhat node at port " + HARDHAT_PORT);
    const ethersNetwork = new Network(localChain.rpc[0], localChain.chainId);
    signer = await new JsonRpcProvider(
      `http://localhost:${HARDHAT_PORT}`,
      ethersNetwork,
      { staticNetwork: ethersNetwork },
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
        sinon.match(/No config provided, using default config/),
      ),
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
        }),
    ).to.throw(
      "Chain configs found for chains that are not being monitored: 2",
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
      storageContractArtifact.abi,
      storageContractArtifact.bytecode,
      [],
    );

    // Set up a nock interceptor to intercept the request to MOCK_SOURCIFY_SERVER url.
    const nockInterceptor = nockInterceptorForVerification(
      MOCK_SOURCIFY_SERVER,
      localChain.chainId,
      contractAddress,
    );

    // start monitor after contract is deployed to avoid sending request before setting up interceptor
    // Need to know the contract address to set up the interceptor
    await monitor.start();
    await new Promise<void>((resolve) => {
      nockInterceptor.on("replied", () => {
        expect(
          nockInterceptor.isDone(),
          `Server ${MOCK_SOURCIFY_SERVER} not called`,
        ).to.be.true;
        resolve();
      });
    });
  });

  it("should use retry mechanism for failed Sourcify request", (done) => {
    const maxRetries = 2;
    monitor = new Monitor([localChain], {
      sourcifyServerURLs: [MOCK_SOURCIFY_SERVER_RETURNING_ERRORS],
      sourcifyRequestOptions: {
        maxRetries,
        retryDelay: 1000,
      },
      chainConfigs: {
        [localChain.chainId]: {
          startBlock: 0,
          blockInterval: HARDHAT_BLOCK_TIME_IN_SEC * 1000,
        },
      },
    });

    deployFromAbiAndBytecode(
      signer,
      storageContractArtifact.abi,
      storageContractArtifact.bytecode,
      [],
    ).then(() => {
      let sourcifyMockTimesCalled = 0;
      nock(MOCK_SOURCIFY_SERVER_RETURNING_ERRORS)
        .post("/")
        .times(maxRetries)
        .reply(function () {
          sourcifyMockTimesCalled++;
          if (sourcifyMockTimesCalled === maxRetries) {
            done();
          }
          return [500];
        });
      monitor.start();
    });
  });
  // Add more test cases as needed
});
