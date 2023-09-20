import { expect } from "chai";
import sinon from "sinon";
// import { EventEmitter } from "stream";
import Monitor from "../src/Monitor";
// import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import ChainMonitor from "../src/ChainMonitor";
// import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";
import logger from "../src/logger";

describe("Monitor", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should use default config when no config is provided", () => {
    const loggerSpy = sinon.spy(logger, "warn");
    const _monitor = new Monitor([
      { chainId: 1337, rpc: ["http://localhost:8545"], name: "Localhost" },
    ]);
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
        new Monitor([{ chainId: 1, rpc: ["http://localhost"], name: "main" }], {
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
    const monitor = new Monitor([
      { chainId: 1, rpc: ["http://localhost"], name: "main" },
    ]);
    await monitor.start();
    expect(chainMonitorStub.called).to.be.true;
  });

  // Add more test cases as needed
});
