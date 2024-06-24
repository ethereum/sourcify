import { StatusCodes } from "http-status-codes";
import chai from "chai";
import config from "config";
import path from "path";
import fs from "fs";
import { getAddress } from "ethers";
import { getMatchStatus } from "../../src/server/common";
import type { Response } from "superagent";
import type { Done } from "mocha";
import { Pool } from "pg";

export const assertValidationError = (
  err: Error | null,
  res: Response,
  field: string,
  message?: string,
) => {
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
export const assertVerification = async (
  sourcifyDatabase: Pool | null,
  err: Error | null,
  res: Response,
  done: Done | null,
  expectedAddress: string,
  expectedChain: string,
  expectedStatus = "perfect",
) => {
  try {
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
      sourcifyDatabase,
      expectedAddress,
      expectedChain,
      expectedStatus,
    );
    if (done) done();
  } catch (e) {
    throw new Error(
      `${(e as Error).message}\nResponse body: ${JSON.stringify(res.body)}`,
    );
  }
};

export const assertVerificationSession = async (
  sourcifyDatabase: Pool | null,
  err: Error | null,
  res: Response,
  done: Done | null,
  expectedAddress: string | undefined,
  expectedChain: string | undefined,
  expectedStatus: string,
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
      sourcifyDatabase,
      expectedAddress,
      expectedChain,
      expectedStatus,
    );
    if (done) done();
  } catch (e) {
    console.log(
      `Failing verification for ${expectedAddress} on chain #${expectedChain}.`,
    );
    console.log("Response body:");
    console.log(JSON.stringify(res.body, null, 2));
    console.log("Chai Error:");
    console.log(e);
    throw e;
  }
};

async function assertContractSaved(
  sourcifyDatabase: Pool | null,
  expectedAddress: string | undefined,
  expectedChain: string | undefined,
  expectedStatus: string,
) {
  if (expectedStatus === "perfect" || expectedStatus === "partial") {
    // Check if saved to fs repository
    const match = expectedStatus === "perfect" ? "full_match" : "partial_match";
    const isExist = fs.existsSync(
      path.join(
        config.get("repositoryV1.path"),
        "contracts",
        match,
        expectedChain ?? "",
        getAddress(expectedAddress ?? ""),
        "metadata.json",
      ),
    );
    chai.expect(isExist, "Contract is not saved").to.be.true;

    if (sourcifyDatabase) {
      // Check if saved to the database
      const res = await sourcifyDatabase.query(
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
        [
          Buffer.from(expectedAddress?.substring(2) ?? "", "hex"),
          expectedChain,
        ],
      );

      const contract = res.rows[0];
      chai.expect(contract).to.not.be.null;
      chai
        .expect("0x" + contract.address.toString("hex"))
        .to.equal(expectedAddress?.toLowerCase());
      chai.expect(contract.chain_id).to.equal(expectedChain);
      // When we'll support runtime_match and creation_match as different statuses we can refine this statement
      chai
        .expect(
          getMatchStatus({
            runtimeMatch: contract.runtime_match,
            creationMatch: contract.creation_match,
            address: "0x" + contract.address.toString("hex"),
            chainId: contract.chain_id,
          }),
        )
        .to.equal(expectedStatus);
    }
  }
}
