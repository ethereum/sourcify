import chai from "chai";
import chaiHttp from "chai-http";
import { StatusCodes } from "http-status-codes";
import {
  assertVerification,
  assertValidationError,
  assertVerificationSession,
} from "../helpers/assertions";
import { sourcifyChainsMap } from "../../src/sourcify-chains";
import testContracts from "../helpers/etherscanInstanceContracts.json";
import {
  waitSecs,
  unusedAddress,
  invalidAddress,
  unsupportedChain,
  verifyAndAssertEtherscanSession,
  verifyAndAssertEtherscan,
} from "../helpers/helpers";
import { default as fetch } from "node-fetch";
import type { Response } from "superagent";
import { ServerFixture } from "../helpers/ServerFixture";

chai.use(chaiHttp);

const CUSTOM_PORT = 5678;

describe("Import From Etherscan and Verify", function () {
  // Don't run if it's an external PR. Etherscan tests need API keys that can't be exposed to external PRs.
  if (process.env.CIRCLE_PR_REPONAME !== undefined) {
    return;
  }

  const serverFixture = new ServerFixture({ port: CUSTOM_PORT });

  beforeEach(async () => {
    await waitSecs(1);
  });

  const assertEtherscanError = (
    err: Error | null,
    res: Response,
    errorMessage: string,
    status?: number
  ) => {
    try {
      chai.expect(res.status).to.equal(status || StatusCodes.NOT_FOUND);
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
          serverFixture,
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
          .request(serverFixture.server.app)
          .post("/verify/etherscan")
          .field("address", contract.address)
          .field("chainId", tempChainId)
          .end(async (err, res) => {
            await assertVerification(
              null,
              err,
              res,
              done,
              contract.address,
              tempChainId,
              contract.expectedStatus
            );
          });
      });

      it("should support a custom api key", (done) => {
        const contract = testContracts[tempChainId][0];
        chai
          .request(serverFixture.server.app)
          .post("/verify/etherscan")
          .field("address", contract.address)
          .field("chainId", tempChainId)
          .field("apiKey", "TEST")
          .end((err, res) => {
            chai
              .expect(res.body.error)
              .to.equal(
                "Error in Etherscan API response. Result message: Invalid API Key"
              );
            done();
          });
      });

      // Skipping this test for now as they are failing on CI
      it.skip("should fail by exceeding rate limit on etherscan APIs", async () => {
        const chain = "1";
        const address = "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2";
        const sourcifyChain = sourcifyChainsMap[chain];
        let interval;

        console.time("Requests");
        let req = 0;

        // Await until we start getting rate limit errors
        // Interval keeps running after await until cleared
        await new Promise<void>((resolve) => {
          interval = setInterval(() => {
            req++;
            fetch(
              `${
                sourcifyChain.etherscanApi?.apiURL
              }/api?module=contract&action=getsourcecode&address=${address}&apikey=${
                process.env[sourcifyChain.etherscanApi?.apiKeyEnvName || ""]
              }`
            )
              .then((res) => res.json())
              .then((json) => {
                if (json.result === "Max rate limit reached") resolve();
              });
          }, 25);
        });

        console.log("Max rate reached");
        const response = await chai
          .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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
        .request(serverFixture.server.app)
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

    it("should support a custom api key", (done) => {
      chai
        .request(serverFixture.server.app)
        .post("/session/verify/etherscan")
        .field("address", unusedAddress)
        .field("chainId", "1")
        .field("apiKey", "TEST")
        .end((err, res) => {
          chai
            .expect(res.body.error)
            .to.equal(
              "Error in Etherscan API response. Result message: Invalid API Key"
            );
          done();
        });
    });

    describe("Test the session endpoint", () => {
      const tempChainId = "1";
      // Test all three types: "single", "multiple", "standard-json"
      testContracts[tempChainId].forEach((contract) => {
        verifyAndAssertEtherscanSession(
          serverFixture,
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
          .request(serverFixture.server.app)
          .post("/session/verify/etherscan")
          .field("address", contract.address)
          .field("chain", tempChainId)
          .end(async (err, res) => {
            await assertVerificationSession(
              null,
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
        const sourcifyChain = sourcifyChainsMap[chain];
        console.time("Requests");
        let req = 0;
        let interval;

        // Await until we start getting rate limit errors
        // Interval keeps running after await until cleared
        await new Promise<void>((resolve) => {
          interval = setInterval(() => {
            req++;
            fetch(
              `${
                sourcifyChain.etherscanApi?.apiURL
              }/api?module=contract&action=getsourcecode&address=${address}&apikey=${
                process.env[sourcifyChain.etherscanApi?.apiKeyEnvName || ""]
              }`
            )
              .then((res) => res.json())
              .then((json) => {
                if (json.result === "Max rate limit reached") resolve();
              });
          }, 25);
        });

        console.log("Max rate reached");
        const response = await chai
          .request(serverFixture.server.app)
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
