process.env.MOCK_REPOSITORY = "./dist/data/mock-repository";
process.env.SOLC_REPO = "./dist/data/solc-repo";
process.env.SOLJSON_REPO = "./dist/data/soljson-repo";

const Server = require("../dist/server/server").Server;
const chai = require("chai");
const chaiHttp = require("chai-http");
const { StatusCodes } = require("http-status-codes");
const rimraf = require("rimraf");
const util = require("util");
const { etherscanAPIs } = require("../dist/config");
const {
  assertVerification,
  assertValidationError,
  assertVerificationSession,
} = require("./helpers/assertions");
const { sourcifyChainsMap } = require("../dist/sourcify-chains");
const testContracts = require("./helpers/etherscanInstanceContracts.json");
const {
  waitSecs,
  unusedAddress,
  invalidAddress,
  unsupportedChain,
  verifyAndAssertEtherscanSession,
  verifyAndAssertEtherscan,
} = require("./helpers/helpers");
const { default: fetch } = require("node-fetch");

chai.use(chaiHttp);

const CUSTOM_PORT = 5678;

describe("Import From Etherscan and Verify", function () {
  this.beforeEach(async function () {
    await waitSecs(1);
  });

  // Don't run if it's an external PR. Etherscan tests need API keys that can't be exposed to external PRs.
  if (process.env.CIRCLE_PR_REPONAME !== undefined) {
    return;
  }

  this.timeout(7000);
  const server = new Server(CUSTOM_PORT);

  before(async () => {
    const promisified = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Server listening on port ${server.port}!`);
  });

  beforeEach(() => {
    rimraf.sync(server.repository);
  });

  after(() => {
    rimraf.sync(server.repository);
  });

  const assertEtherscanError = (err, res, errorMessage, status) => {
    try {
      chai.expect(res.status).to.equal(status || StatusCodes.BAD_REQUEST);
      chai.expect(res.body?.error).to.equal(errorMessage);
    } catch (e) {
      console.log("Error: ", e);
      console.log("Response: ", res.body);
      throw e;
    }
  };

  describe("Non-Session API", () => {
    it("should fail for missing address", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("chain", "1")
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "address",
            "request/body must have required property 'address'"
          );
          done();
        });
    });

    it("should fail for missing chain", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", unusedAddress)
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "chain",
            "request/body must have required property 'chain'"
          );
          done();
        });
    });

    it("should fail for invalid address", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", invalidAddress)
        .field("chain", "1")
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "address",
            `Invalid address: ${invalidAddress}`
          );
          done();
        });
    });

    it("should fail for unsupported chain", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", unusedAddress)
        .field("chain", unsupportedChain)
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "chain",
            `Chain ${unsupportedChain} not supported for verification!`
          );
          done();
        });
    });

    it("should fail fetching a non verified contract from etherscan", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", unusedAddress)
        .field("chain", "1")
        .end((err, res) => {
          assertEtherscanError(
            err,
            res,
            "This contract is not verified on Etherscan"
          );
          done();
        });
    });

    describe("Test the non-session endpoint", () => {
      const tempChainId = "1";
      // Test with each type "single", "multiple", "standard-json"
      testContracts[tempChainId].forEach((contract) => {
        verifyAndAssertEtherscan(
          server.app,
          tempChainId,
          contract.address,
          contract.expectedStatus,
          contract.type
        );
      });

      // Non-session's default is `chain` but shoudl also work with `chainId`
      it("should also work with `chainId` instead of `chain`", (done) => {
        const contract = testContracts[tempChainId][0];
        chai
          .request(server.app)
          .post("/verify/etherscan")
          .field("address", contract.address)
          .field("chainId", tempChainId)
          .end((err, res) => {
            // currentResponse = res;
            assertVerification(
              err,
              res,
              done,
              contract.address,
              tempChainId,
              contract.expectedStatus
            );
          });
      });

      // Skipping this test for now as they are failing on CI
      it.skip("should fail by exceeding rate limit on etherscan APIs", async () => {
        const chain = "1";
        const address = "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2";

        let interval;

        console.time("Requests");
        let req = 0;

        // Await until we start getting rate limit errors
        // Interval keeps running after await until cleared
        await new Promise((resolve) => {
          interval = setInterval(() => {
            req++;
            fetch(
              `${etherscanAPIs[chain].apiURL}/api?module=contract&action=getsourcecode&address=${address}&apikey=${etherscanAPIs[chain].apiKey}`
            )
              .then((res) => res.json())
              .then((json) => {
                if (json.result === "Max rate limit reached") resolve();
              });
          }, 25);
        });

        console.log("Max rate reached");
        const response = await chai
          .request(server.app)
          .post("/verify/etherscan")
          .field("address", "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2")
          .field("chain", "1");

        console.timeEnd("Requests");
        console.log("Total reqs: ", req);
        clearInterval(interval);
        assertEtherscanError(
          null,
          response,
          "Etherscan API rate limit reached, try later",
          StatusCodes.TOO_MANY_REQUESTS
        );

        await waitSecs(2); // Wait for the rate limit to reset
        return true;
      });
    });
  });

  describe("Session API", () => {
    it("should fail for missing address", (done) => {
      chai
        .request(server.app)
        .post("/session/verify/etherscan/")
        .field("chainId", "1")
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "address",
            "request/body must have required property 'address'"
          );
          done();
        });
    });

    it("should fail for missing chain", (done) => {
      chai
        .request(server.app)
        .post("/session/verify/etherscan/")
        .field("address", unusedAddress)
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "chain",
            "request/body must have required property 'chain'"
          );
          done();
        });
    });

    it("should fail for invalid address", (done) => {
      chai
        .request(server.app)
        .post("/session/verify/etherscan")
        .field("address", invalidAddress)
        .field("chain", "1")
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "address",
            `Invalid address: ${invalidAddress}`
          );
          done();
        });
    });

    it("should fail for unsupported chain", (done) => {
      chai
        .request(server.app)
        .post("/session/verify/etherscan")
        .field("address", unusedAddress)
        .field("chain", unsupportedChain)
        .end((err, res) => {
          assertValidationError(
            err,
            res,
            "chain",
            `Chain ${unsupportedChain} not supported for verification!`
          );
          done();
        });
    });

    it("should fail fetching a non verified contract from etherscan", (done) => {
      chai
        .request(server.app)
        .post("/session/verify/etherscan")
        .field("address", unusedAddress)
        .field("chainId", "1")
        .end((err, res) => {
          assertEtherscanError(
            err,
            res,
            "This contract is not verified on Etherscan"
          );
          done();
        });
    });

    describe("Test the session endpoint", () => {
      const tempChainId = "1";
      // Test all three types: "single", "multiple", "standard-json"
      testContracts[tempChainId].forEach((contract) => {
        verifyAndAssertEtherscanSession(
          server.app,
          tempChainId,
          contract.address,
          contract.expectedStatus,
          contract.type
        );
      });

      // Session's default is `body.chainId` but should also work with `chain`
      it("should also work with `chain` instead of `chainId`", (done) => {
        const contract = testContracts[tempChainId][0];
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", contract.address)
          .field("chain", tempChainId)
          .end((err, res) => {
            // currentResponse = res;
            assertVerificationSession(
              err,
              res,
              done,
              contract.address,
              tempChainId,
              contract.expectedStatus
            );
          });
      });

      // Skipping this test for now as they are failing on CI
      it.skip("should fail by exceeding rate limit on etherscan APIs", async () => {
        const chain = "1";
        const address = "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2";
        console.time("Requests");
        let req = 0;
        let interval;

        // Await until we start getting rate limit errors
        // Interval keeps running after await until cleared
        await new Promise((resolve) => {
          interval = setInterval(() => {
            req++;
            fetch(
              `${etherscanAPIs[chain].apiURL}/api?module=contract&action=getsourcecode&address=${address}&apikey=${etherscanAPIs[chain].apiKey}`
            )
              .then((res) => res.json())
              .then((json) => {
                if (json.result === "Max rate limit reached") resolve();
              });
          }, 25);
        });

        console.log("Max rate reached");
        const response = await chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2")
          .field("chain", "1");

        console.timeEnd("Requests");
        console.log("Total reqs: ", req);
        clearInterval(interval);
        assertEtherscanError(
          null,
          response,
          "Etherscan API rate limit reached, try later",
          StatusCodes.TOO_MANY_REQUESTS
        );

        await waitSecs(2); // Wait for the rate limit to reset
        return true;
      });
    });
  });
});
