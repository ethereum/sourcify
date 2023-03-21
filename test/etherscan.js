process.env.MOCK_REPOSITORY = "./dist/data/mock-repository";
process.env.SOLC_REPO = "./dist/data/solc-repo";
process.env.SOLJSON_REPO = "./dist/data/soljson-repo";

const chai = require("chai");
const chaiHttp = require("chai-http");
const { StatusCodes } = require("http-status-codes");
const rimraf = require("rimraf");
const util = require("util");
const Server = require("../dist/server/server").Server;
const { etherscanAPIs } = require("../dist/config");
const {
  assertVerification,
  assertValidationError,
  assertVerificationSession,
} = require("./helpers/assertions");
const { sourcifyChainsMap } = require("../dist/sourcify-chains");
const testContracts = require("./helpers/etherscanInstanceContracts.json");
const { waitSecs, unusedAddress } = require("./helpers/helpers");
const { default: fetch } = require("node-fetch");

chai.use(chaiHttp);

const CUSTOM_PORT = 5678;

describe("Import From Etherscan and Verify", function () {
  // Don't run if it's an external PR. Etherscan tests need API keys that can't be exposed to external PRs.
  if (process.env.CIRCLE_PR_REPONAME !== undefined) {
    return;
  }

  this.timeout(5000);
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

  const assertEtherscanError = (err, res, errorMessage) => {
    chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
    chai.expect(res.body?.error).to.equal(errorMessage);
  };

  describe("Non-Session API", () => {
    it("should fail for missing address", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("chain", "1")
        .end((err, res) => {
          assertValidationError(err, res, "address");
          done();
        });
    });

    it("should fail for missing chain", (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", unusedAddress)
        .end((err, res) => {
          assertValidationError(err, res, "chain");
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

    it("should fail by exceeding rate limit on etherscan APIs", (done) => {
      const chain = "1";
      const address = "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2";

      // Have to send fetch directly here otherwise can't go faster than 5 req/s
      for (let i = 0; i < 30; i++) {
        fetch(
          `${etherscanAPIs[chain].apiURL}/api?module=contract&action=getsourcecode&address=${address}&apikey=${etherscanAPIs[chain].apiKey}`
        );
      }

      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2")
        .field("chain", "1")
        .end((err, res) => {
          assertEtherscanError(
            err,
            res,
            "Etherscan API rate limit reached, try later"
          );
          waitSecs(1.5) // Wait for the rate limit to reset
            .then(() => {
              done();
            });
        });
    });
  });

  describe("Test each Etherscan instance", () => {
    for (const chainId in testContracts) {
      describe(`#${chainId} ${sourcifyChainsMap[chainId].name}`, () => {
        testContracts[chainId].forEach((contract) => {
          verifyAndAssertEtherscan(
            chainId,
            contract.address,
            contract.expectedStatus,
            contract.type,
            contract?.creatorTxHash
          );
        });
      });
    }
  });

  function verifyAndAssertEtherscan(
    chainId,
    address,
    expectedStatus,
    type,
    creatorTxHash
  ) {
    it(`Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${etherscanAPIs[chainId].apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
      let request = chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", address)
        .field("chain", chainId);
      if (creatorTxHash) {
        request = request.field("creatorTxHash", creatorTxHash);
      }
      request.end((err, res) => {
        // currentResponse = res;
        assertVerification(err, res, done, address, chainId, expectedStatus);
      });
    });
  }
  function verifyAndAssertEtherscanSession(
    chainId,
    address,
    expectedStatus,
    type
  ) {
    it(`Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${etherscanAPIs[chainId].apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
      chai
        .request(server.app)
        .post("/verify/etherscan")
        .field("address", address)
        .field("chain", chainId)
        .end((err, res) => {
          // currentResponse = res;
          assertVerificationSession(
            err,
            res,
            done,
            address,
            chainId,
            expectedStatus
          );
        });
    });
  }
});
