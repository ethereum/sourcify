// Periodical tests of Import from Etherscan for each instance e.g. Arbiscan, Etherscan, Bscscan, etc.

import { Server } from "../../src/server/server";
import rimraf from "rimraf";
import testContracts from "../helpers/etherscanInstanceContracts.json";
import {
  sourcifyChainsMap,
  sourcifyChainsArray,
} from "../../src/sourcify-chains";
import util from "util";
import { verifyAndAssertEtherscan } from "../helpers/helpers";
import chai from "chai";

const CUSTOM_PORT = 5679;

describe("Test each Etherscan instance", function () {
  this.timeout(30000);
  const server = new Server(CUSTOM_PORT);

  before(async () => {
    const promisified: any = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Server listening on port ${server.port}!`);
  });

  beforeEach(() => {
    rimraf.sync(server.repository);
  });

  after(() => {
    rimraf.sync(server.repository);
  });

  const testedChains: number[] = [];
  let chainId: keyof typeof testContracts;
  for (chainId in testContracts) {
    if (!sourcifyChainsMap[chainId].supported) {
      throw new Error(
        `Unsupported chain (${chainId}) found in test configuration`
      );
    }
    if (process.env.TEST_CHAIN && process.env.TEST_CHAIN !== chainId) continue;
    testedChains.push(parseInt(chainId));
    describe(`#${chainId} ${sourcifyChainsMap[chainId].name}`, () => {
      testContracts[chainId].forEach((contract) => {
        verifyAndAssertEtherscan(
          server.app,
          chainId,
          contract.address,
          contract.expectedStatus,
          contract.type
        );
      });
    });
  }
  describe("Double check that all supported chains are tested", () => {
    const supportedEtherscanChains = sourcifyChainsArray.filter(
      (chain) => chain.etherscanApi && chain.supported
    );

    it("should have tested all supported chains", function (done) {
      const untestedChains = supportedEtherscanChains.filter(
        (chain) => !testedChains.includes(chain.chainId)
      );
      if (process.env.TEST_CHAIN) {
        return this.skip();
      }
      chai.assert(
        untestedChains.length == 0,
        `There are untested supported chains!: ${untestedChains
          .map((chain) => `${chain.name} (${chain.chainId})`)
          .join(", ")}`
      );

      done();
    });
  });
});
