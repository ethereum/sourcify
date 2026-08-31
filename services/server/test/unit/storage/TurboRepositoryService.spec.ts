import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { generateKeyPairSync } from "crypto";
import {
  TurboUpload,
  deserializeTags,
  parseDataItem,
} from "@ardrive/turbo-upload";
import type { ArweaveJWK, SignedDataItem } from "@ardrive/turbo-upload";
import { getAddress, id as keccak256 } from "ethers";
import { TurboRepositoryService } from "../../../src/server/services/storageServices/TurboRepositoryService";
import { WStorageIdentifiers } from "../../../src/server/services/storageServices/identifiers";
import { MockVerificationExport } from "../../helpers/mocks";

use(chaiAsPromised);

// An Arweave wallet is an RSA-4096 JWK, and @ardrive/turbo-upload validates it
// in its constructor, so the tests need a real key rather than a placeholder
// string. Generated once here instead of committing a private key to the repo;
// it takes tens of milliseconds.
const testJwk = generateKeyPairSync("rsa", {
  modulusLength: 4096,
}).privateKey.export({ format: "jwk" }) as unknown as ArweaveJWK;

const tagsOf = (item: SignedDataItem): Record<string, string> =>
  deserializeTags(parseDataItem(item.binary).rawTags).reduce<
    Record<string, string>
  >((acc, { name, value }) => {
    acc[name] = value;
    return acc;
  }, {});

const dataOf = (item: SignedDataItem): string =>
  parseDataItem(item.binary).rawData.toString("utf8");

describe("TurboRepositoryService", function () {
  const sandbox = sinon.createSandbox();

  let signSpy: sinon.SinonSpy;
  let uploadSignedStub: sinon.SinonStub;
  let getBalanceStub: sinon.SinonStub;
  let getFreeUploadLimitStub: sinon.SinonStub;

  const createService = (
    options: Partial<{
      privateKey: string;
      token: "arweave";
      appName: string;
      gatewayUrl: string;
      uploadServiceUrl: string;
      uploadTimeout: number;
    }> = {},
  ): TurboRepositoryService =>
    new TurboRepositoryService({
      privateKey: JSON.stringify(testJwk),
      ...options,
    });

  // The items handed to uploadSigned, in call order. Signing is left real so
  // the assertions run against the bytes that would have gone on the wire.
  const uploadedItems = (): SignedDataItem[] =>
    uploadSignedStub.getCalls().map((call) => call.args[0]);

  beforeEach(() => {
    signSpy = sandbox.spy(TurboUpload.prototype, "sign");
    uploadSignedStub = sandbox
      .stub(TurboUpload.prototype, "uploadSigned")
      .callsFake(async (item) =>
        Promise.resolve({
          id: (item as SignedDataItem).idB64Url,
          owner: "test-address",
          byteCount: (item as SignedDataItem).binary.length,
          winc: "0",
        }),
      );
    getBalanceStub = sandbox
      .stub(TurboUpload.prototype, "getBalance")
      .resolves({
        winc: "0",
        controlledWinc: "0",
        effectiveBalance: "0",
        address: "test-address",
      });
    getFreeUploadLimitStub = sandbox
      .stub(TurboUpload.prototype, "getFreeUploadLimitBytes")
      .resolves(107520);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("has the TurboRepository identifier", () => {
    expect(createService().IDENTIFIER).to.equal(
      WStorageIdentifiers.TurboRepository,
    );
  });

  it("accepts an Arweave JWK passed as a JSON string", () => {
    expect(() => createService()).to.not.throw();
  });

  it("throws when the Arweave JWK is not valid JSON", () => {
    expect(() => createService({ privateKey: "{not-json" })).to.throw(
      /not valid JSON/,
    );
  });

  it("rejects an unknown token instead of failing on the first upload", () => {
    expect(() =>
      createService({ token: "etherium" as unknown as "arweave" }),
    ).to.throw(/Unsupported token "etherium"/);
  });

  it("treats an unset token environment variable as the default", () => {
    expect(() =>
      createService({ token: "" as unknown as "arweave" }),
    ).to.not.throw();
  });

  it("initializes even when Turbo is unreachable", async () => {
    const service = createService();
    getBalanceStub.rejects(new Error("Turbo is down"));
    getFreeUploadLimitStub.rejects(new Error("Turbo is down"));
    await expect(service.init()).to.eventually.equal(true);
  });

  it("uploads every file of a verification with retrieval tags", async () => {
    const service = createService();
    const verification = structuredClone(MockVerificationExport);

    await expect(service.storeVerification(verification)).to.eventually.be
      .fulfilled;

    const uploads = uploadedItems();
    const address = getAddress(verification.address);
    const chainId = verification.chainId.toString();
    const [sourcePath, sourceContent] = Object.entries(
      verification.compilation.sources,
    )[0];
    expect(sourcePath).to.be.a("string");

    // One data item per file: the source, the metadata, the creation tx hash
    // and the library map.
    expect(uploads).to.have.lengthOf(4);
    expect(uploads.map((item) => tagsOf(item)["File-Path"])).to.deep.equal([
      `contracts/full_match/${chainId}/${address}/sources/${keccak256(sourceContent)}`,
      `contracts/full_match/${chainId}/${address}/metadata.json`,
      `contracts/full_match/${chainId}/${address}/creator-tx-hash.txt`,
      `contracts/full_match/${chainId}/${address}/library-map.json`,
    ]);

    for (const item of uploads) {
      const tags = tagsOf(item);
      expect(tags["App-Name"]).to.equal("Sourcify");
      expect(tags["Chain-Id"]).to.equal(chainId);
      expect(tags["Contract-Address"]).to.equal(address);
      expect(tags["Match-Quality"]).to.equal("full");
    }

    expect(dataOf(uploads[0])).to.equal(sourceContent);
    expect(tagsOf(uploads[0])["Content-Type"]).to.equal("text/plain");
    expect(dataOf(uploads[1])).to.equal(
      JSON.stringify(verification.compilation.metadata),
    );
    expect(tagsOf(uploads[1])["Content-Type"]).to.equal("application/json");
    expect(dataOf(uploads[2])).to.equal(verification.deploymentInfo.txHash);
    expect(tagsOf(uploads[2])["Content-Type"]).to.equal("text/plain");
  });

  it("signs each file exactly once, so the logged id is the id that is uploaded", async () => {
    const service = createService();

    await service.storeVerification(structuredClone(MockVerificationExport));

    // RSA-PSS draws a fresh salt per signature: signing twice would produce a
    // second item with a different id, and pay for both. sign() and
    // uploadSigned() must therefore pair up one-to-one, on the same bytes.
    expect(signSpy.callCount).to.equal(uploadSignedStub.callCount);
    for (const [index, item] of uploadedItems().entries()) {
      expect(item).to.equal(signSpy.returnValues[index]);
    }
    const ids = uploadedItems().map((item) => item.idB64Url);
    expect(new Set(ids).size).to.equal(ids.length);
  });

  it("tags a partial match as partial", async () => {
    const service = createService({ appName: "Sourcify-Staging" });
    const verification = structuredClone(MockVerificationExport);
    verification.status = { runtimeMatch: "partial", creationMatch: null };

    await expect(service.storeVerification(verification)).to.eventually.be
      .fulfilled;

    for (const item of uploadedItems()) {
      const tags = tagsOf(item);
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
    sinon.assert.notCalled(uploadSignedStub);
  });

  it("rethrows upload errors so the storage service can warn", async () => {
    const service = createService();
    uploadSignedStub.rejects(new Error("Turbo is down"));

    await expect(
      service.storeVerification(structuredClone(MockVerificationExport)),
    ).to.eventually.be.rejectedWith("Turbo is down");
  });

  it("bounds an upload by the configured timeout, not only by shutdown", async () => {
    const service = createService({ uploadTimeout: 5 });
    uploadSignedStub.callsFake(async (item) => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { id: (item as SignedDataItem).idB64Url };
    });

    await service.storeVerification(structuredClone(MockVerificationExport));

    // The client applies uploadTimeout per HTTP request and retries three
    // times, so the whole operation is bounded by the signal as well.
    const { signal } = uploadSignedStub.firstCall.args[1];
    expect(signal.aborted).to.equal(true);
  });

  it("aborts in-flight uploads on close", async () => {
    const service = createService();
    await service.storeVerification(structuredClone(MockVerificationExport));
    const { signal } = uploadSignedStub.firstCall.args[1];
    expect(signal.aborted).to.equal(false);

    await service.close();
    // The signal handed to Turbo is derived from the service's controller
    expect(signal.aborted).to.equal(true);
  });
});
