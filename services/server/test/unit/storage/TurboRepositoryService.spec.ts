import type { MatchQuality } from "../../../src/server/types";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { generateKeyPairSync } from "crypto";
import {
  TurboUpload,
  TurboHTTPError,
  deserializeTags,
  parseDataItem,
} from "@ardrive/turbo-upload";
import type { ArweaveJWK, SignedDataItem } from "@ardrive/turbo-upload";
import { getAddress, id as keccak256 } from "ethers";
import { TurboRepositoryService } from "../../../src/server/services/storageServices/TurboRepositoryService";
import { WStorageIdentifiers } from "../../../src/server/services/storageServices/identifiers";
import { MockVerificationExport } from "../../helpers/mocks";
import logger from "../../../src/common/logger";

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

/**
 * @ardrive/turbo-upload declares no constructor for its error classes, so
 * TypeScript infers Error's `(message?: string)` while the runtime constructor
 * takes an options object. Cast once here rather than at every call site.
 */
const HTTPError = TurboHTTPError as unknown as new (init: {
  status: number;
  statusText?: string;
  endpoint: string;
  method: string;
  body?: unknown;
}) => TurboHTTPError;

describe("TurboRepositoryService", function () {
  const sandbox = sinon.createSandbox();

  let signSpy: sinon.SinonSpy;
  let uploadSignedStub: sinon.SinonStub;
  let getBalanceStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let errorSpy: sinon.SinonSpy;
  let warnSpy: sinon.SinonSpy;
  let infoSpy: sinon.SinonSpy;

  const createService = (
    options: Partial<{
      privateKey: string;
      token: "arweave";
      appName: string;
      gatewayUrl: string;
      uploadServiceUrl: string;
      uploadTimeout: number;
      minBalanceWinc: string;
      chainIds: string[];
      matchQualities: MatchQuality[];
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
    getInfoStub = sandbox.stub(TurboUpload.prototype, "getInfo").resolves({
      freeUploadLimitBytes: 107520,
      freeTier: {
        lifetimeBytes: 10485760,
        ipBytes: 10485760,
        maxItemBytes: 107520,
      },
    });
    errorSpy = sandbox.spy(logger, "error");
    warnSpy = sandbox.spy(logger, "warn");
    infoSpy = sandbox.spy(logger, "info");
  });

  // The alarm is identified by its message, not by the count of error logs,
  // so an unrelated error elsewhere cannot make these pass or fail.
  const creditAlarms = () =>
    errorSpy
      .getCalls()
      .filter((call) => /cannot pay for uploads/.test(String(call.args[0])));

  const paymentRequired = () =>
    new HTTPError({
      status: 402,
      statusText: "Payment Required",
      endpoint: "https://upload.ardrive.io/v1/tx",
      method: "POST",
      body: { x402Version: 1 },
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
    getInfoStub.rejects(new Error("Turbo is down"));
    await expect(service.init()).to.eventually.equal(true);
  });

  it("warns at startup when there is nothing left to spend", async () => {
    const service = createService();
    await service.init();

    const [message, metadata] = warnSpy.lastCall.args as [
      string,
      Record<string, unknown>,
    ];
    expect(message).to.match(/no credit to spend/);
    // The free tier is a fixed lifetime allowance, so the size of the runway
    // an operator is relying on is part of the warning.
    expect(metadata.freeTier).to.deep.equal({
      perItemBytes: 107520,
      lifetimeBytes: 10485760,
      perIpBytes: 10485760,
    });
    expect(metadata.winc).to.equal("0");
  });

  it("does not warn at startup when the balance is above the minimum", async () => {
    const service = createService();
    getBalanceStub.resolves({
      winc: "1000000000",
      controlledWinc: "1000000000",
      effectiveBalance: "1000000000",
      address: "test-address",
    });

    await service.init();

    expect(warnSpy.called).to.equal(false);
    expect(String(infoSpy.lastCall.args[0])).to.match(
      /TurboRepository initialized/,
    );
  });

  it("warns at startup when the balance is at or below the configured minimum", async () => {
    const service = createService({ minBalanceWinc: "1000" });
    getBalanceStub.resolves({
      winc: "999",
      controlledWinc: "999",
      effectiveBalance: "999",
      address: "test-address",
    });

    await service.init();

    expect(String(warnSpy.lastCall.args[0])).to.match(/no credit to spend/);
    // Winston credits can exceed Number.MAX_SAFE_INTEGER, so the comparison is
    // done on BigInts and not on parsed numbers.
    const big = createService({
      minBalanceWinc: "90071992547409910000",
    });
    getBalanceStub.resolves({
      winc: "90071992547409920000",
      controlledWinc: "0",
      effectiveBalance: "0",
      address: "test-address",
    });
    warnSpy.resetHistory();
    await big.init();
    expect(warnSpy.called).to.equal(false);
  });

  it("rejects a minimum balance that is not a whole number of credits", () => {
    expect(() => createService({ minBalanceWinc: "1.5 AR" })).to.throw(
      /whole number of winston credits/,
    );
    expect(() => createService({ minBalanceWinc: "-1" })).to.throw(
      /must not be negative/,
    );
  });

  it("raises one credit alarm, not one per verification, while the wallet is empty", async () => {
    const service = createService();
    uploadSignedStub.rejects(paymentRequired());

    // storeVerification stops at the first failing file, so an empty wallet
    // produces one refusal per verification. On a busy server that is one error
    // line per verification until someone notices.
    for (let i = 0; i < 3; i++) {
      await expect(
        service.storeVerification(structuredClone(MockVerificationExport)),
      ).to.eventually.be.rejected;
    }

    expect(creditAlarms()).to.have.lengthOf(1);
    const [message, metadata] = creditAlarms()[0].args as [
      string,
      Record<string, unknown>,
    ];
    expect(message).to.match(/nothing is being archived to Arweave/);
    expect(metadata.uploadsLostToPayment).to.equal(1);
    expect(metadata.remedy).to.be.a("string");
    // Nothing is lost: the suppressed refusals are still counted.
    expect(
      (creditAlarms()[0].args[1] as Record<string, unknown>).status,
    ).to.equal(402);
  });

  it("announces recovery once uploads are paid for again", async () => {
    const service = createService();
    uploadSignedStub.rejects(paymentRequired());
    await expect(
      service.storeVerification(structuredClone(MockVerificationExport)),
    ).to.eventually.be.rejected;
    expect(creditAlarms()).to.have.lengthOf(1);

    uploadSignedStub.callsFake(async (item) => ({
      id: (item as SignedDataItem).idB64Url,
      owner: "test-address",
      byteCount: (item as SignedDataItem).binary.length,
      winc: "0",
    }));
    await service.storeVerification(structuredClone(MockVerificationExport));

    expect(
      infoSpy
        .getCalls()
        .filter((call) => /archiving again/.test(String(call.args[0]))),
    ).to.have.lengthOf(1);

    // And the alarm arms again if it happens a second time.
    uploadSignedStub.rejects(paymentRequired());
    await expect(
      service.storeVerification(structuredClone(MockVerificationExport)),
    ).to.eventually.be.rejected;
    expect(creditAlarms()).to.have.lengthOf(2);
  });

  it("still throws a payment failure so the storage service can warn", async () => {
    const service = createService();
    uploadSignedStub.rejects(paymentRequired());

    await expect(
      service.storeVerification(structuredClone(MockVerificationExport)),
    ).to.eventually.be.rejectedWith(/402/);
  });

  it("keeps reporting non-payment failures individually", async () => {
    const service = createService();
    uploadSignedStub.rejects(
      new HTTPError({
        status: 503,
        statusText: "Service Unavailable",
        endpoint: "https://upload.ardrive.io/v1/tx",
        method: "POST",
        body: "upstream unavailable",
      }),
    );

    for (let i = 0; i < 3; i++) {
      await expect(
        service.storeVerification(structuredClone(MockVerificationExport)),
      ).to.eventually.be.rejected;
    }

    // A transient failure is not a standing condition: it is not suppressed,
    // and it does not raise the credit alarm.
    expect(creditAlarms()).to.have.lengthOf(0);
    expect(
      errorSpy
        .getCalls()
        .filter((call) =>
          /Failed to store file to Turbo/.test(String(call.args[0])),
        ),
    ).to.have.lengthOf(3);
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

  it("archives everything when no scope is configured, as it always did", async () => {
    const service = createService();
    await service.init();
    await service.storeVerification(structuredClone(MockVerificationExport));
    expect(uploadedItems()).to.have.lengthOf(4);
  });

  it("skips a chain outside the configured scope, and uploads nothing", async () => {
    // The mock verifies on chain 31337. Scoping to mainnet must archive none of
    // it. This is the whole point: Arweave is paid for per byte and permanent,
    // so an operator has to be able to say what is worth keeping.
    const service = createService({ chainIds: ["1"] });
    await service.init();
    await service.storeVerification(structuredClone(MockVerificationExport));
    expect(uploadedItems()).to.have.lengthOf(0);
  });

  it("archives a chain that is in scope", async () => {
    const service = createService({ chainIds: ["31337", "1"] });
    await service.init();
    await service.storeVerification(structuredClone(MockVerificationExport));
    expect(uploadedItems()).to.have.lengthOf(4);
  });

  it("skips a match quality outside the configured scope", async () => {
    const service = createService({ matchQualities: ["partial"] });
    await service.init();
    await service.storeVerification(structuredClone(MockVerificationExport));
    expect(uploadedItems()).to.have.lengthOf(0);
  });

  it("applies both filters together, and both must pass", async () => {
    const right = createService({
      chainIds: ["31337"],
      matchQualities: ["full"],
    });
    await right.init();
    await right.storeVerification(structuredClone(MockVerificationExport));
    expect(uploadedItems()).to.have.lengthOf(4);

    uploadSignedStub.resetHistory();
    const wrong = createService({
      chainIds: ["31337"],
      matchQualities: ["partial"],
    });
    await wrong.init();
    await wrong.storeVerification(structuredClone(MockVerificationExport));
    expect(uploadedItems()).to.have.lengthOf(0);
  });

  it("costs nothing when everything is out of scope: it does not even sign", async () => {
    // Signing an RSA-4096 item is not free, and a filtered-out file should not
    // pay for it. A filter that signs and then discards is not a filter.
    const service = createService({ chainIds: ["1"] });
    await service.init();
    signSpy.resetHistory();
    await service.storeVerification(structuredClone(MockVerificationExport));
    expect(signSpy.callCount).to.equal(0);
  });
});
