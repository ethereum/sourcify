const { StatusCodes } = require("http-status-codes");
const chai = require("chai");
const config = require("../../dist/config").default;
const path = require("path");
const fs = require("fs");

exports.assertValidationError = (err, res, field) => {
  chai.expect(err).to.be.null;
  chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
  chai.expect(res.body.message.startsWith("Validation Error")).to.be.true;
  chai.expect(res.body.errors).to.be.an("array");
  chai.expect(res.body.errors).to.have.a.lengthOf(1);
  chai.expect(res.body.errors[0].field).to.equal(field);
};

exports.assertVerification = (
  err,
  res,
  done,
  expectedAddress,
  expectedChain,
  expectedStatus = "perfect"
) => {
  // currentResponse = res;
  chai.expect(err).to.be.null;
  chai.expect(res.status).to.equal(StatusCodes.OK);
  chai.expect(res.body).to.haveOwnProperty("result");
  const resultArr = res.body.result;
  chai.expect(resultArr).to.have.a.lengthOf(1);
  const result = resultArr[0];
  chai.expect(result.address).to.equal(expectedAddress);
  chai.expect(result.chainId).to.equal(expectedChain);
  chai.expect(result.status).to.equal(expectedStatus);

  assertContractSaved(expectedAddress, expectedChain, expectedStatus);
  if (done) done();
};

exports.assertVerificationSession = (
  err,
  res,
  done,
  expectedAddress,
  expectedChain,
  expectedStatus
) => {
  chai.expect(err).to.be.null;
  chai.expect(res.status).to.equal(StatusCodes.OK);

  const contracts = res.body.contracts;
  chai.expect(contracts).to.have.a.lengthOf(1);
  const contract = contracts[0];

  chai.expect(contract.status).to.equal(expectedStatus);
  chai.expect(contract.address).to.equal(expectedAddress);
  chai.expect(contract.chainId).to.equal(expectedChain);

  chai.expect(contract.storageTimestamp).to.not.exist;
  chai.expect(res.body.unused).to.be.empty;
  assertContractSaved(expectedAddress, expectedChain, expectedStatus);
  if (done) done();
};

/**
 * Lookup (check-by-address etc.) doesn't return chainId, otherwise same as assertVerification
 */
exports.assertLookup = (err, res, expectedAddress, expectedStatus, done) => {
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
exports.assertLookupAll = (
  err,
  res,
  expectedAddress,
  expectedChainIds, // Array of { chainId, status }
  done
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

function assertContractSaved(expectedAddress, expectedChain, expectedStatus) {
  // Check if saved to the disk
  if (expectedStatus === "perfect" || expectedStatus === "partial") {
    const match = expectedStatus === "perfect" ? "full_match" : "partial_match";
    const isExist = fs.existsSync(
      path.join(
        config.repository.path,
        "contracts",
        match,
        expectedChain,
        expectedAddress,
        "metadata.json"
      )
    );
    chai.expect(isExist).to.be.true;
  }
}
