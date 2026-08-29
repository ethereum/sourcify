import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { TurboFactory } from "@ardrive/turbo-sdk";
import type { TurboAuthenticatedClient } from "@ardrive/turbo-sdk";
import { getAddress, id as keccak256 } from "ethers";
import { TurboRepositoryService } from "../../../src/server/services/storageServices/TurboRepositoryService";
import { WStorageIdentifiers } from "../../../src/server/services/storageServices/identifiers";
import { MockVerificationExport } from "../../helpers/mocks";

use(chaiAsPromised);

type Tag = { name: string; value: string };

const tagsToObject = (tags: Tag[]): Record<string, string> =>
  tags.reduce<Record<string, string>>((acc, { name, value }) => {
    acc[name] = value;
    return acc;
  }, {});

describe("TurboRepositoryService", function () {
  const sandbox = sinon.createSandbox();

  let uploadStub: sinon.SinonStub;
  let getBalanceStub: sinon.SinonStub;
  let getNativeAddressStub: sinon.SinonStub;

  const createService = (
    options: Partial<{
      privateKey: string;
      appName: string;
      gatewayUrl: string;
    }> = {},
  ): TurboRepositoryService =>
    new TurboRepositoryService({
      privateKey: "0x0123456789abcdef",
      ...options,
    });

  beforeEach(() => {
    uploadStub = sandbox.stub().resolves({ id: "data-item-id", winc: "0" });
    getBalanceStub = sandbox.stub().resolves({ winc: "0" });
    getNativeAddressStub = sandbox.stub().resolves("native-address");
    sandbox.stub(TurboFactory, "authenticated").returns({
      upload: uploadStub,
      getBalance: getBalanceStub,
      signer: { getNativeAddress: getNativeAddressStub },
    } as unknown as TurboAuthenticatedClient);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("has the TurboRepository identifier", () => {
    expect(createService().IDENTIFIER).to.equal(
      WStorageIdentifiers.TurboRepository,
    );
  });

  it("parses an Arweave JWK passed as a JSON string", () => {
    createService({ privateKey: '{"kty":"RSA","n":"test"}' });
    const { privateKey } = (TurboFactory.authenticated as sinon.SinonStub)
      .firstCall.args[0];
    expect(privateKey).to.deep.equal({ kty: "RSA", n: "test" });
  });

  it("throws when the Arweave JWK is not valid JSON", () => {
    expect(() => createService({ privateKey: "{not-json" })).to.throw(
      "Failed to parse the Turbo Arweave JWK",
    );
  });

  it("initializes even when Turbo is unreachable", async () => {
    const service = createService();
    getBalanceStub.rejects(new Error("Turbo is down"));
    await expect(service.init()).to.eventually.equal(true);
  });

  it("uploads every file of a verification with retrieval tags", async () => {
    const service = createService();
    const verification = structuredClone(MockVerificationExport);

    await expect(service.storeVerification(verification)).to.eventually.be
      .fulfilled;

    const uploads = uploadStub.getCalls().map((call) => ({
      data: call.args[0].data,
      tags: tagsToObject(call.args[0].dataItemOpts.tags),
    }));

    const address = getAddress(verification.address);
    const chainId = verification.chainId.toString();
    const [sourcePath, sourceContent] = Object.entries(
      verification.compilation.sources,
    )[0];
    expect(sourcePath).to.be.a("string");

    // One data item per file: the source, the metadata, the creation tx hash
    // and the library map.
    expect(uploads).to.have.lengthOf(4);
    expect(uploads.map(({ tags }) => tags["File-Path"])).to.deep.equal([
      `contracts/full_match/${chainId}/${address}/sources/${keccak256(sourceContent)}`,
      `contracts/full_match/${chainId}/${address}/metadata.json`,
      `contracts/full_match/${chainId}/${address}/creator-tx-hash.txt`,
      `contracts/full_match/${chainId}/${address}/library-map.json`,
    ]);

    for (const { tags } of uploads) {
      expect(tags["App-Name"]).to.equal("Sourcify");
      expect(tags["Chain-Id"]).to.equal(chainId);
      expect(tags["Contract-Address"]).to.equal(address);
      expect(tags["Match-Quality"]).to.equal("full");
    }

    expect(uploads[0].data).to.equal(sourceContent);
    expect(uploads[0].tags["Content-Type"]).to.equal("text/plain");
    expect(uploads[1].data).to.equal(
      JSON.stringify(verification.compilation.metadata),
    );
    expect(uploads[1].tags["Content-Type"]).to.equal("application/json");
    expect(uploads[2].data).to.equal(verification.deploymentInfo.txHash);
    expect(uploads[2].tags["Content-Type"]).to.equal("text/plain");
  });

  it("tags a partial match as partial", async () => {
    const service = createService({ appName: "Sourcify-Staging" });
    const verification = structuredClone(MockVerificationExport);
    verification.status = { runtimeMatch: "partial", creationMatch: null };

    await expect(service.storeVerification(verification)).to.eventually.be
      .fulfilled;

    for (const call of uploadStub.getCalls()) {
      const tags = tagsToObject(call.args[0].dataItemOpts.tags);
      expect(tags["App-Name"]).to.equal("Sourcify-Staging");
      expect(tags["Match-Quality"]).to.equal("partial");
      expect(tags["File-Path"]).to.match(/^contracts\/partial_match\//);
    }
  });

  it("does not try to delete partial matches", async () => {
    const service = createService();
    await expect(
      service.deletePartialIfExists("31337", MockVerificationExport.address),
    ).to.eventually.be.fulfilled;
    sinon.assert.notCalled(uploadStub);
  });

  it("rethrows upload errors so the storage service can warn", async () => {
    const service = createService();
    uploadStub.rejects(new Error("Turbo is down"));

    await expect(
      service.storeVerification(structuredClone(MockVerificationExport)),
    ).to.eventually.be.rejectedWith("Turbo is down");
  });

  it("aborts in-flight uploads on close", async () => {
    const service = createService();
    await service.storeVerification(structuredClone(MockVerificationExport));
    const { signal } = uploadStub.firstCall.args[0];
    expect(signal.aborted).to.equal(false);

    await service.close();
    // The signal handed to Turbo is derived from the service's controller
    const { signal: signalAfterClose } = uploadStub.firstCall.args[0];
    expect(signalAfterClose.aborted).to.equal(true);
  });
});
