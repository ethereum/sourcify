import chai from "chai";
import path from "path";
import fs from "fs";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";
import { deployFromAbiAndBytecode } from "../../helpers/helpers";
import { assertVerification } from "../../helpers/assertions";
import chaiHttp from "chai-http";
import { StatusCodes } from "http-status-codes";
import { VerifyVyperRequest } from "../../../src/server/controllers/verification/vyper/stateless/vyper.stateless.handlers";
import { VyperSettings } from "@ethereum-sourcify/lib-sourcify";
import contractArtifact from "../../sources/vyper/testcontract/artifact.json";

chai.use(chaiHttp);

describe("/verify/vyper", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  // Default test contract
  const contractFileName = "test.vy";
  const contractSourcePath = path.join(
    __dirname,
    "..",
    "..",
    "sources",
    "vyper",
    "testcontract",
    contractFileName,
  );
  const contractFileContent = fs.readFileSync(contractSourcePath);

  const deployAndVerifyVyperTestContract = async (
    additionalRequestOptions: Partial<VerifyVyperRequest["body"]> = {},
  ) => {
    const address = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      contractArtifact.abi,
      contractArtifact.bytecode,
    );
    const res = await verifyVyperTestContract(
      address,
      additionalRequestOptions,
    );
    return { res, address };
  };

  const verifyVyperTestContract = async (
    address: string,
    additionalRequestOptions: Partial<VerifyVyperRequest["body"]> = {},
  ) => {
    const res = await chai
      .request(serverFixture.server.app)
      .post("/verify/vyper")
      .send({
        address: address,
        chain: chainFixture.chainId,
        files: {
          [contractFileName]: contractFileContent.toString(),
        },
        contractPath: contractFileName,
        contractName: contractFileName.split(".")[0],
        compilerVersion: "0.3.10+commit.91361694",
        compilerSettings: {
          evmVersion: "istanbul",
          outputSelection: {
            "*": ["evm.bytecode"],
          },
        },
        ...additionalRequestOptions,
      });
    return res;
  };

  it("should verify a vyper contract resulting in a partial match", async () => {
    const { res, address } = await deployAndVerifyVyperTestContract();

    await assertVerification(
      serverFixture,
      null,
      res,
      null,
      address,
      chainFixture.chainId,
      "partial",
    );
  });

  it("should return an error if the files are not provided", async () => {
    const { res } = await deployAndVerifyVyperTestContract({ files: {} });

    chai.expect(res.status).to.equal(StatusCodes.NOT_FOUND);
    chai.expect(res.body).to.haveOwnProperty("error");
  });

  it("should return an error if the compiler input is invalid", async () => {
    const { res } = await deployAndVerifyVyperTestContract({
      compilerSettings: {
        // Invalid EVM version
        evmVersion: "invalidEvm" as VyperSettings["evmVersion"],
        outputSelection: {
          "*": ["evm.bytecode"],
        },
      },
    });

    chai.expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    chai.expect(res.body).to.haveOwnProperty("error");
  });

  it("should return an error if the contract is already verified", async () => {
    const { address } = await deployAndVerifyVyperTestContract();

    const res = await verifyVyperTestContract(address);

    chai.expect(res.status).to.equal(StatusCodes.CONFLICT);
    chai.expect(res.body).to.haveOwnProperty("error");
  });

  it("should return an error if the deployed and recompiled bytecodes mismatch", async () => {
    const contract2Artifact = (
      await import("../../sources/vyper/testcontract2/artifact.json")
    ).default;

    const contract2Address = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      contract2Artifact.abi,
      contract2Artifact.bytecode,
    );

    // Uses the default testcontract files to verify
    const res = await verifyVyperTestContract(contract2Address);

    chai.expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    chai.expect(res.body).to.haveOwnProperty("error");
  });
});
