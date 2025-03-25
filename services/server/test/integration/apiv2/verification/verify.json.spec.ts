import chai from "chai";
import chaiHttp from "chai-http";
import {
  deployFromAbiAndBytecode,
  deployFromAbiAndBytecodeForCreatorTxHash,
  hookIntoVerificationWorkerRun,
} from "../../../helpers/helpers";
import { LocalChainFixture } from "../../../helpers/LocalChainFixture";
import { ServerFixture } from "../../../helpers/ServerFixture";
import path from "path";
import fs from "fs";
import { assertContractSaved } from "../../../helpers/assertions";
import sinon from "sinon";

chai.use(chaiHttp);

describe("POST /v2/verify/:chainId/:address", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();
  const sandbox = sinon.createSandbox();
  const makeWorkersWait = hookIntoVerificationWorkerRun(sandbox, serverFixture);

  afterEach(async () => {
    sandbox.restore();
  });

  it("should verify a contract with Solidity standard input JSON", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const { contractAddress, txHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi,
        chainFixture.defaultContractArtifact.bytecode,
      );

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes.status).to.equal(202);
    chai.expect(verifyRes.body).to.have.property("verificationId");
    chai
      .expect(verifyRes.body.verificationId)
      .to.match(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      );

    const jobRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    chai.expect(jobRes.status).to.equal(200);
    chai.expect(jobRes.body).to.deep.include({
      isJobCompleted: false,
      verificationId: verifyRes.body.verificationId,
      contract: {
        match: null,
        creationMatch: null,
        runtimeMatch: null,
        chainId: chainFixture.chainId,
        address: contractAddress,
      },
    });
    chai.expect(jobRes.body.error).to.be.undefined;

    await resolveWorkers();

    const jobRes2 = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    const verifiedContract = {
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address: contractAddress,
    };

    chai.expect(jobRes2.status).to.equal(200);
    chai.expect(jobRes2.body).to.include({
      isJobCompleted: true,
      verificationId: verifyRes.body.verificationId,
    });
    chai.expect(jobRes2.body.error).to.be.undefined;
    chai.expect(jobRes2.body.contract).to.include(verifiedContract);

    const contractRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contract/${chainFixture.chainId}/${contractAddress}`);

    chai.expect(contractRes.status).to.equal(200);
    chai.expect(contractRes.body).to.include(verifiedContract);

    await assertContractSaved(
      serverFixture.sourcifyDatabase,
      contractAddress,
      chainFixture.chainId,
      "perfect",
    );
  });

  it("should verify a Vyper contract", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const vyperContractPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "sources",
      "vyper",
      "testcontract",
    );
    const vyperArtifactPath = path.join(vyperContractPath, "artifact.json");
    const vyperArtifact = JSON.parse(
      fs.readFileSync(vyperArtifactPath, "utf8"),
    );
    const vyperSourceFileName = "test.vy";
    const vyperSourcePath = path.join(vyperContractPath, vyperSourceFileName);
    const vyperSource = fs.readFileSync(vyperSourcePath, "utf8");

    const { contractAddress, txHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        chainFixture.localSigner,
        vyperArtifact.abi,
        vyperArtifact.bytecode,
      );

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Vyper",
        stdJsonInput: {
          language: "Vyper",
          sources: {
            [vyperSourceFileName]: {
              content: vyperSource,
            },
          },
          settings: {
            evmVersion: "istanbul",
            outputSelection: {
              "*": ["evm.bytecode"],
            },
          },
        },
        compilerVersion: "0.3.10+commit.91361694",
        contractIdentifier: `${vyperSourceFileName}:${vyperSourceFileName.split(".")[0]}`,
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes.status).to.equal(202);
    chai.expect(verifyRes.body).to.have.property("verificationId");
    chai
      .expect(verifyRes.body.verificationId)
      .to.match(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      );

    const jobRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    chai.expect(jobRes.status).to.equal(200);
    chai.expect(jobRes.body).to.deep.include({
      isJobCompleted: false,
      verificationId: verifyRes.body.verificationId,
      contract: {
        match: null,
        creationMatch: null,
        runtimeMatch: null,
        chainId: chainFixture.chainId,
        address: contractAddress,
      },
    });
    chai.expect(jobRes.body.error).to.be.undefined;

    await resolveWorkers();

    const jobRes2 = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    chai.expect(jobRes2.status).to.equal(200);
    chai.expect(jobRes2.body).to.include({
      isJobCompleted: true,
      verificationId: verifyRes.body.verificationId,
    });
    chai.expect(jobRes2.body.contract).to.include({
      match: "match",
      creationMatch: "match",
      runtimeMatch: "match",
      chainId: chainFixture.chainId,
      address: contractAddress,
    });

    await assertContractSaved(
      serverFixture.sourcifyDatabase,
      contractAddress,
      chainFixture.chainId,
      "partial",
    );
  });

  it("should default to Solidity if no language is specified", async () => {
    const { resolveWorkers, runTaskStub } = makeWorkersWait();

    const { contractAddress, txHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi,
        chainFixture.defaultContractArtifact.bytecode,
      );

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes.status).to.equal(202);

    chai.expect(runTaskStub.calledOnce).to.be.true;
    chai.expect(runTaskStub.args[0][0].language).to.equal("Solidity");

    await resolveWorkers();

    const jobRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    chai.expect(jobRes.status).to.equal(200);
    chai.expect(jobRes.body).to.include({
      isJobCompleted: true,
    });
    chai.expect(jobRes.body.error).to.be.undefined;
    chai.expect(jobRes.body.contract).to.include({
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address: contractAddress,
    });
  });

  it("should fetch the creation transaction hash if not provided", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const contractAddress = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      chainFixture.defaultContractArtifact.abi,
      chainFixture.defaultContractArtifact.bytecode,
    );

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
      });

    chai.expect(verifyRes.status).to.equal(202);

    await resolveWorkers();

    const jobRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    chai.expect(jobRes.status).to.equal(200);
    chai.expect(jobRes.body).to.include({
      isJobCompleted: true,
    });
    chai.expect(jobRes.body.error).to.be.undefined;
    chai.expect(jobRes.body.contract).to.include({
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address: contractAddress,
    });
  });

  it("should store a job error if the compiler returns an error", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const { contractAddress, txHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi,
        chainFixture.defaultContractArtifact.bytecode,
      );

    const sourcePath = Object.keys(
      chainFixture.defaultContractMetadataObject.settings.compilationTarget,
    )[0];
    const jsonInput = JSON.parse(
      JSON.stringify(chainFixture.defaultContractJsonInput),
    );
    // Introduce a syntax error in the source code
    jsonInput.sources[sourcePath].content = jsonInput.sources[
      sourcePath
    ].content.replace("contract", "contrat");

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: jsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes.status).to.equal(202);

    await resolveWorkers();

    const jobRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/verify/${verifyRes.body.verificationId}`);

    chai.expect(jobRes.status).to.equal(200);
    chai.expect(jobRes.body).to.include({
      isJobCompleted: true,
    });
    chai.expect(jobRes.body.error).to.exist;
    chai.expect(jobRes.body.error.customCode).to.equal("compiler_error");
    chai.expect(jobRes.body.contract).to.deep.equal({
      match: null,
      creationMatch: null,
      runtimeMatch: null,
      chainId: chainFixture.chainId,
      address: contractAddress,
    });
  });

  it("should return a 409 if the contract is being verified at the moment already", async () => {
    makeWorkersWait();

    const { contractAddress, txHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi,
        chainFixture.defaultContractArtifact.bytecode,
      );

    // First verification request
    const verifyRes1 = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes1.status).to.equal(202);

    // Second verification request before the first one completes
    const verifyRes2 = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes2.status).to.equal(409);
    chai
      .expect(verifyRes2.body.customCode)
      .to.equal("duplicate_verification_request");
    chai.expect(verifyRes2.body).to.have.property("errorId");
    chai.expect(verifyRes2.body).to.have.property("message");
  });

  it("should return a 409 if the contract is already verified", async () => {
    const { resolveWorkers, runTaskStub } = makeWorkersWait();

    const { contractAddress, txHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi,
        chainFixture.defaultContractArtifact.bytecode,
      );

    // First verification request
    const verifyRes1 = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes1.status).to.equal(202);

    await resolveWorkers();
    const contractRes = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contract/${chainFixture.chainId}/${contractAddress}`);

    chai.expect(contractRes.status).to.equal(200);
    chai.expect(contractRes.body).to.include({
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address: contractAddress,
    });

    runTaskStub.restore();
    const { resolveWorkers: resolveWorkers2 } = makeWorkersWait();

    // Second verification
    const verifyRes2 = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/${chainFixture.chainId}/${contractAddress}`)
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: txHash,
      });

    chai.expect(verifyRes2.status).to.equal(409);
    chai.expect(verifyRes2.body.customCode).to.equal("already_verified");
    chai.expect(verifyRes2.body).to.have.property("errorId");
    chai.expect(verifyRes2.body).to.have.property("message");

    await resolveWorkers2();
  });

  it("should return 400 when contract identifier is missing", async () => {
    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");
  });

  it("should return 400 when compiler version is missing", async () => {
    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        language: "Solidity",
        stdJsonInput: chainFixture.defaultContractJsonInput,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");
  });

  it("should return 400 when standard JSON input is missing", async () => {
    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        language: "Solidity",
        compilerVersion:
          chainFixture.defaultContractMetadataObject.compiler.version,
        contractIdentifier: Object.entries(
          chainFixture.defaultContractMetadataObject.settings.compilationTarget,
        )[0].join(":"),
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");
  });
});
