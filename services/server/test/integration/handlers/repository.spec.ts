
import { assertValidationError, assertLookup } from "../../helpers/assertions";
import chai from "chai";
import chaiHttp from "chai-http";
import _checkedContract from "../../testcontracts/Database/CheckedContract.json";

import { StatusCodes } from "http-status-codes";
import {
  invalidAddress,
} from "../../helpers/helpers";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";

chai.use(chaiHttp);

describe("repository handlers", async function () {
  const chainFixture =  new LocalChainFixture();
  const serverFixture = new ServerFixture();

  describe("/check-by-addresses", async function () {
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
            .attach("files", chainFixture.defaultContractMetadata, "metadata.json")
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
                    done
                  )
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
          assertLookup(err, res, chainFixture.defaultContractAddress, "false", done);
        });
    });
  });
});
