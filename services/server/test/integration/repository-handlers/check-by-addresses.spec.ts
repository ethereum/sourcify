import { assertValidationError } from "../../helpers/assertions";
import chai from "chai";
import chaiHttp from "chai-http";
import { StatusCodes } from "http-status-codes";
import { invalidAddress } from "../../helpers/helpers";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";
import type { Done } from "mocha";
import type { Response } from "superagent";

chai.use(chaiHttp);

/**
 * Lookup (check-by-address etc.) doesn't return chainId, otherwise same as assertVerification
 */
const assertLookup = (
  err: Error | null,
  res: Response,
  expectedAddress: string,
  expectedStatus: string,
  done?: Done,
) => {
  chai.expect(err).to.be.null;
  chai.expect(res.status).to.equal(StatusCodes.OK);
  const resultArray = res.body;
  chai.expect(resultArray).to.have.a.lengthOf(1);
  const result = resultArray[0];
  chai.expect(result.status).to.equal(expectedStatus);
  chai.expect(result.address).to.equal(expectedAddress);
  if (done) done();
};

/**
 * check-all-by-address returns chain and status objects in an array.
 */
const assertLookupAll = (
  err: Error | null,
  res: Response,
  expectedAddress: string,
  expectedChainIds: { chainId: string; status: string }[],
  done?: Done,
) => {
  chai.expect(err).to.be.null;
  chai.expect(res.status).to.equal(StatusCodes.OK);
  const resultArray = res.body;
  chai.expect(resultArray).to.have.a.lengthOf(1);
  const result = resultArray[0];
  chai.expect(result.address).to.equal(expectedAddress);
  chai.expect(result.chainIds).to.deep.equal(expectedChainIds);
  if (done) done();
};

describe("/check-by-addresses", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  it("should fail for missing chainIds", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-by-addresses")
      .query({ addresses: chainFixture.defaultContractAddress })
      .end((err, res) => {
        assertValidationError(err, res, "chainIds");
        done();
      });
  });

  it("should fail for missing addresses", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-by-addresses")
      .query({ chainIds: 1 })
      .end((err, res) => {
        assertValidationError(err, res, "addresses");
        done();
      });
  });

  it("should return false for previously unverified contract", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-by-addresses")
      .query({
        chainIds: chainFixture.chainId,
        addresses: chainFixture.defaultContractAddress,
      })
      .end((err, res) => {
        assertLookup(err, res, chainFixture.defaultContractAddress, "false");
        done();
      });
  });

  it("should fail for invalid address", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-by-addresses")
      .query({ chainIds: chainFixture.chainId, addresses: invalidAddress })
      .end((err, res) => {
        assertValidationError(err, res, "addresses");
        done();
      });
  });

  it("should return false for unverified contract but then perfect after verification", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-by-addresses")
      .query({
        chainIds: chainFixture.chainId,
        addresses: chainFixture.defaultContractAddress,
      })
      .end((err, res) => {
        assertLookup(err, res, chainFixture.defaultContractAddress, "false");
        chai
          .request(serverFixture.server.app)
          .post("/")
          .field("address", chainFixture.defaultContractAddress)
          .field("chain", chainFixture.chainId)
          .attach(
            "files",
            chainFixture.defaultContractMetadata,
            "metadata.json",
          )
          .attach("files", chainFixture.defaultContractSource)
          .end((err, res) => {
            chai.expect(err).to.be.null;
            chai.expect(res.status).to.equal(StatusCodes.OK);

            chai
              .request(serverFixture.server.app)
              .get("/check-by-addresses")
              .query({
                chainIds: chainFixture.chainId,
                addresses: chainFixture.defaultContractAddress,
              })
              .end((err, res) =>
                assertLookup(
                  err,
                  res,
                  chainFixture.defaultContractAddress,
                  "perfect",
                  done,
                ),
              );
          });
      });
  });

  it("should convert addresses to checksummed format", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-by-addresses")
      .query({
        chainIds: chainFixture.chainId,
        addresses: chainFixture.defaultContractAddress.toLowerCase(),
      })
      .end((err, res) => {
        assertLookup(
          err,
          res,
          chainFixture.defaultContractAddress,
          "false",
          done,
        );
      });
  });
});

describe("/check-all-by-addresses", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  it("should fail for missing chainIds", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-all-by-addresses")
      .query({ addresses: chainFixture.defaultContractAddress })
      .end((err, res) => {
        assertValidationError(err, res, "chainIds");
        done();
      });
  });

  it("should fail for missing addresses", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-all-by-addresses")
      .query({ chainIds: 1 })
      .end((err, res) => {
        assertValidationError(err, res, "addresses");
        done();
      });
  });

  it("should return false for previously unverified contract", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-all-by-addresses")
      .query({
        chainIds: chainFixture.chainId,
        addresses: chainFixture.defaultContractAddress,
      })
      .end((err, res) =>
        assertLookup(
          err,
          res,
          chainFixture.defaultContractAddress,
          "false",
          done,
        ),
      );
  });

  it("should fail for invalid address", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-all-by-addresses")
      .query({ chainIds: chainFixture.chainId, addresses: invalidAddress })
      .end((err, res) => {
        assertValidationError(err, res, "addresses");
        done();
      });
  });

  it("should return false for unverified contract but then perfect after verification", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-all-by-addresses")
      .query({
        chainIds: chainFixture.chainId,
        addresses: chainFixture.defaultContractAddress,
      })
      .end((err, res) => {
        assertLookup(err, res, chainFixture.defaultContractAddress, "false");
        chai
          .request(serverFixture.server.app)
          .post("/")
          .field("address", chainFixture.defaultContractAddress)
          .field("chain", chainFixture.chainId)
          .attach(
            "files",
            chainFixture.defaultContractMetadata,
            "metadata.json",
          )
          .attach("files", chainFixture.defaultContractSource)
          .end((err, res) => {
            chai.expect(err).to.be.null;
            chai.expect(res.status).to.equal(StatusCodes.OK);

            chai
              .request(serverFixture.server.app)
              .get("/check-all-by-addresses")
              .query({
                chainIds: chainFixture.chainId,
                addresses: chainFixture.defaultContractAddress,
              })
              .end((err, res) =>
                assertLookupAll(
                  err,
                  res,
                  chainFixture.defaultContractAddress,
                  [{ chainId: chainFixture.chainId, status: "perfect" }],
                  done,
                ),
              );
          });
      });
  });

  it("should convert addresses to checksummed format", (done) => {
    chai
      .request(serverFixture.server.app)
      .get("/check-all-by-addresses")
      .query({
        chainIds: chainFixture.chainId,
        addresses: chainFixture.defaultContractAddress.toLowerCase(),
      })
      .end((err, res) => {
        chai.expect(err).to.be.null;
        chai.expect(res.status).to.equal(StatusCodes.OK);
        chai.expect(res.body).to.have.a.lengthOf(1);
        const result = res.body[0];
        chai
          .expect(result.address)
          .to.equal(chainFixture.defaultContractAddress);
        chai.expect(result.status).to.equal("false");
        done();
      });
  });
});
