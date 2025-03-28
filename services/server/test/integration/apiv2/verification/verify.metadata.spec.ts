import chai from "chai";
import chaiHttp from "chai-http";
import { hookIntoVerificationWorkerRun } from "../../../helpers/helpers";
import { LocalChainFixture } from "../../../helpers/LocalChainFixture";
import { ServerFixture } from "../../../helpers/ServerFixture";
import { assertContractSaved } from "../../../helpers/assertions";
import sinon from "sinon";

chai.use(chaiHttp);

describe("POST /v2/verify/metadata/:chainId/:address", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();
  const sandbox = sinon.createSandbox();
  const makeWorkersWait = hookIntoVerificationWorkerRun(sandbox, serverFixture);

  afterEach(async () => {
    sandbox.restore();
  });

  it("should verify a contract via Solidity metadata", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
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
        address: chainFixture.defaultContractAddress,
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
      address: chainFixture.defaultContractAddress,
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
      .get(
        `/v2/contract/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      );

    chai.expect(contractRes.status).to.equal(200);
    chai.expect(contractRes.body).to.include(verifiedContract);

    await assertContractSaved(
      serverFixture.sourcifyDatabase,
      chainFixture.defaultContractAddress,
      chainFixture.chainId,
      "perfect",
    );
  });

  it("should fetch the creation transaction hash if not provided", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
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
      address: chainFixture.defaultContractAddress,
    });
  });

  it("should store a job error if the metadata validation fails", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractModifiedSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
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
    chai
      .expect(jobRes.body.error.customCode)
      .to.equal("missing_or_invalid_source");
    chai.expect(jobRes.body.contract).to.deep.equal({
      match: null,
      creationMatch: null,
      runtimeMatch: null,
      chainId: chainFixture.chainId,
      address: chainFixture.defaultContractAddress,
    });
  });

  it("should fetch a missing file from IPFS", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {},
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
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
      address: chainFixture.defaultContractAddress,
    });
  });

  it("should store a job error if missing sources cannot be fetched", async () => {
    const { resolveWorkers } = makeWorkersWait();

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataWithModifiedIpfsHash,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
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
    chai
      .expect(jobRes.body.error.customCode)
      .to.equal("missing_or_invalid_source");
    chai.expect(jobRes.body.contract).to.deep.equal({
      match: null,
      creationMatch: null,
      runtimeMatch: null,
      chainId: chainFixture.chainId,
      address: chainFixture.defaultContractAddress,
    });
  });

  it("should return a 429 if the contract is being verified at the moment already", async () => {
    makeWorkersWait();

    // First verification request
    const verifyRes1 = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes1.status).to.equal(202);

    // Second verification request before the first one completes
    const verifyRes2 = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes2.status).to.equal(429);
    chai
      .expect(verifyRes2.body.customCode)
      .to.equal("duplicate_verification_request");
    chai.expect(verifyRes2.body).to.have.property("errorId");
    chai.expect(verifyRes2.body).to.have.property("message");
  });

  it("should return a 409 if the contract is already verified", async () => {
    const { resolveWorkers, runTaskStub } = makeWorkersWait();

    // First verification request
    const verifyRes1 = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes1.status).to.equal(202);

    await resolveWorkers();
    const contractRes = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contract/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      );

    chai.expect(contractRes.status).to.equal(200);
    chai.expect(contractRes.body).to.include({
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address: chainFixture.defaultContractAddress,
    });

    runTaskStub.restore();
    const { resolveWorkers: resolveWorkers2 } = makeWorkersWait();

    // Second verification
    const verifyRes2 = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes2.status).to.equal(409);
    chai.expect(verifyRes2.body.customCode).to.equal("already_verified");
    chai.expect(verifyRes2.body).to.have.property("errorId");
    chai.expect(verifyRes2.body).to.have.property("message");

    await resolveWorkers2();
  });

  it("should return a 400 when the sources are missing", async () => {
    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");
  });

  it("should return a 400 when metadata is missing", async () => {
    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");
  });

  it("should return a 400 when the address is invalid", async function () {
    const invalidAddress =
      chainFixture.defaultContractAddress.slice(0, 41) + "G";

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(`/v2/verify/metadata/${chainFixture.chainId}/${invalidAddress}`)
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");
  });

  it("should return a 404 when the chain is not found", async function () {
    const unknownChainId = "5";

    // Make sure chain is not found
    const chainMap = serverFixture.server.chainRepository.sourcifyChainMap;
    const chainToRestore = chainMap[unknownChainId];
    delete chainMap[unknownChainId];

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post(
        `/v2/verify/metadata/${unknownChainId}/${chainFixture.defaultContractAddress}`,
      )
      .send({
        sources: {
          [Object.keys(chainFixture.defaultContractMetadataObject.sources)[0]]:
            chainFixture.defaultContractSource,
        },
        metadata: chainFixture.defaultContractMetadataObject,
        creationTransactionHash: chainFixture.defaultContractCreatorTx,
      });

    chai.expect(verifyRes.status).to.equal(400);
    chai.expect(verifyRes.body.customCode).to.equal("invalid_parameter");
    chai.expect(verifyRes.body).to.have.property("errorId");
    chai.expect(verifyRes.body).to.have.property("message");

    // Restore chain
    chainMap[unknownChainId] = chainToRestore;
  });
});
