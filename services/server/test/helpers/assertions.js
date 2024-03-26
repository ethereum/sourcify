const { StatusCodes } = require("http-status-codes");
const chai = require("chai");
const config = require("config");
const path = require("path");
const fs = require("fs");
const { getAddress } = require("ethers");
const { getMatchStatus } = require("../../dist/server/common");

exports.assertValidationError = (err, res, field, message) => {
  try {
    chai.expect(err).to.be.null;
    chai.expect(res.body.message.toLowerCase()).to.include(field.toLowerCase());
    if (message) chai.expect(res.body.message).to.equal(message);
    chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
  } catch (err) {
    console.log("Not validating as expected:");
    console.log(JSON.stringify(res.body, null, 2));
    throw err;
  }
};

// If you pass storageService = false, then the match will not be compared to the database
exports.assertVerification = async (
  storageService,
  err,
  res,
  done,
  expectedAddress,
  expectedChain,
  expectedStatus = "perfect"
) => {
  try {
    // currentResponse = res;
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.OK);
    chai.expect(res.body).to.haveOwnProperty("result");
    const resultArr = res.body.result;
    chai.expect(resultArr).to.have.a.lengthOf(1);
    const result = resultArr[0];
    chai
      .expect(result.address.toLowerCase())
      .to.equal(expectedAddress.toLowerCase());
    chai.expect(result.chainId).to.equal(expectedChain);
    chai.expect(result.status).to.equal(expectedStatus);

    await assertContractSaved(
      storageService,
      expectedAddress,
      expectedChain,
      expectedStatus
    );
    if (done) done();
  } catch (e) {
    e.message += `\nResponse body: ${JSON.stringify(res.body)}`;
    throw e;
  }
};

exports.assertVerificationSession = async (
  storageService,
  err,
  res,
  done,
  expectedAddress,
  expectedChain,
  expectedStatus
) => {
  try {
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.OK);

    const contracts = res.body.contracts;
    chai.expect(contracts).to.have.a.lengthOf(1);
    const contract = contracts[0];

    chai.expect(contract.status).to.equal(expectedStatus);
    chai.expect(contract.address).to.equal(expectedAddress);
    chai.expect(contract.chainId).to.equal(expectedChain);

    chai.expect(contract.storageTimestamp).to.not.exist;
    chai.expect(contract.files.missing).to.be.empty;
    chai.expect(contract.files.invalid).to.be.empty;

    await assertContractSaved(
      storageService,
      expectedAddress,
      expectedChain,
      expectedStatus
    );
    if (done) done();
  } catch (e) {
    console.log(
      `Failing verification for ${expectedAddress} on chain #${expectedChain}.`
    );
    console.log("Response body:");
    console.log(JSON.stringify(res.body, null, 2));
    console.log("Chai Error:");
    console.log(e);
    throw e;
  }
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

async function assertContractSaved(
  storageService,
  expectedAddress,
  expectedChain,
  expectedStatus
) {
  if (expectedStatus === "perfect" || expectedStatus === "partial") {
    // Check if saved to fs repository
    const match = expectedStatus === "perfect" ? "full_match" : "partial_match";
    const isExist = fs.existsSync(
      path.join(
        config.get("repositoryV1.path"),
        "contracts",
        match,
        expectedChain,
        getAddress(expectedAddress),
        "metadata.json"
      )
    );
    chai.expect(isExist, "Contract is not saved").to.be.true;

    if (storageService) {
      // Check if saved to the database
      await storageService.sourcifyDatabase.init();
      const res = await storageService.sourcifyDatabase.databasePool.query(
        `SELECT
        cd.address,
        cd.chain_id,
        sm.creation_match,
        sm.runtime_match
      FROM sourcify_matches sm
      LEFT JOIN verified_contracts vc ON vc.id = sm.verified_contract_id
      LEFT JOIN contract_deployments cd ON cd.id = vc.deployment_id
      LEFT JOIN compiled_contracts cc ON cc.id = vc.compilation_id 
      LEFT JOIN code compiled_runtime_code ON compiled_runtime_code.code_hash = cc.runtime_code_hash
      LEFT JOIN code compiled_creation_code ON compiled_creation_code.code_hash = cc.creation_code_hash
      WHERE cd.address = $1 AND cd.chain_id = $2`,
        [Buffer.from(expectedAddress.substring(2), "hex"), expectedChain]
      );

      const contract = res.rows[0];
      chai
        .expect("0x" + contract.address.toString("hex"))
        .to.equal(expectedAddress.toLowerCase());
      chai.expect(contract.chain_id).to.equal(expectedChain);
      // When we'll support runtime_match and creation_match as different statuses we can refine this statement
      chai
        .expect(
          getMatchStatus({
            runtimeMatch: contract.runtime_match,
            creationMatch: contract.creation_match,
          })
        )
        .to.equal(expectedStatus);
    }
  }
}
