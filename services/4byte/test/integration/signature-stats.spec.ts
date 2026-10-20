import http from "http";
import type { AddressInfo } from "net";
import chai from "chai";
import { FourByteServerFixture } from "../helpers/FourByteServerFixture";
import { SignatureStats } from "../../src/SignatureStats";
import { SignatureType } from "../../src/utils/signature-util";
import logger from "../../src/logger";

describe("SignatureStats with a base file", function () {
  const serverFixture = new FourByteServerFixture({ port: 4446 });

  let baseServer: http.Server;
  let baseUrl: string;
  let baseStatus = 200;
  let baseBody = "";
  let lastPath: string | undefined;

  const HOUR_MS = 60 * 60 * 1000;

  // The format of the BigQuery JSON export: one line, INT64 as strings
  const baseFile = (t0: Date, counts: Record<string, number>) =>
    JSON.stringify({
      t0: t0.toISOString(),
      ...Object.fromEntries(
        Object.entries(counts).map(([k, v]) => [k, String(v)]),
      ),
    }) + "\n";

  const BASE_COUNTS = {
    function: 1000,
    event: 200,
    error: 30,
    unknown: 400,
    total: 1500,
  };

  const createStats = () =>
    new SignatureStats(serverFixture.server.database, logger, {
      baseUrl,
      cacheTtlMs: 0,
    });

  before(async () => {
    baseServer = http.createServer((req, res) => {
      // Fake metadata server and Cloud Storage API for gs:// URLs
      if (req.url === "/token") {
        res.end(
          JSON.stringify({ access_token: "test-token", expires_in: 3600 }),
        );
        return;
      }
      if (
        req.url?.startsWith("/storage/") &&
        req.headers.authorization !== "Bearer test-token"
      ) {
        res.statusCode = 401;
        res.end();
        return;
      }
      lastPath = req.url;
      res.statusCode = baseStatus;
      res.end(baseBody);
    });
    await new Promise<void>((resolve) => baseServer.listen(0, resolve));
    baseUrl = `http://localhost:${(baseServer.address() as AddressInfo).port}/production-000000000000.json`;
  });

  after(async () => {
    await new Promise((resolve) => baseServer.close(resolve));
  });

  beforeEach(async () => {
    baseStatus = 200;
    await serverFixture.resetDatabase();
    // Before t0: in the base file, so not in the delta
    await serverFixture.insertTestSignatures([
      { signature: "old()", type: SignatureType.Function },
    ]);
    await serverFixture.pool.query(
      "UPDATE signatures SET created_at = now() - interval '2 hours'",
    );
    // After t0: the delta
    await serverFixture.insertTestSignatures([
      { signature: "fn()", type: SignatureType.Function },
      { signature: "Ev()", type: SignatureType.Event },
      { signature: "Err()", type: SignatureType.Error },
      { signature: "both()", type: SignatureType.Function },
      { signature: "both()", type: SignatureType.Event },
      { signature: "imported()" },
    ]);
  });

  it("should add the new Postgres rows to the base", async function () {
    baseBody = baseFile(new Date(Date.now() - HOUR_MS), BASE_COUNTS);
    const stats = createStats();
    await stats.start();

    const result = await stats.getStats();
    stats.stop();

    chai.expect(result.count).to.deep.equal({
      function: 1000 + 2,
      event: 200 + 2,
      error: 30 + 1,
      unknown: 400 + 1,
      total: 1500 + 5,
    });
  });

  it("should read a gs:// file with the token of the service account", async function () {
    baseBody = baseFile(new Date(Date.now() - HOUR_MS), BASE_COUNTS);
    const origin = new URL(baseUrl).origin;
    const stats = new SignatureStats(serverFixture.server.database, logger, {
      baseUrl: "gs://stats-bucket/production-000000000000.json",
      gcsApiUrl: origin,
      metadataTokenUrl: `${origin}/token`,
      cacheTtlMs: 0,
    });
    await stats.start();

    const result = await stats.getStats();
    stats.stop();

    chai
      .expect(lastPath)
      .to.equal(
        "/storage/v1/b/stats-bucket/o/production-000000000000.json?alt=media",
      );
    chai.expect(result.count.function).to.equal(1000 + 2);
  });

  it("should count an imported signature with its type after a contract uses it", async function () {
    baseBody = baseFile(new Date(Date.now() - HOUR_MS), BASE_COUNTS);
    const stats = createStats();
    await stats.start();

    await serverFixture.insertVerifiedContract({
      name: "Uses",
      chainId: 1,
      address: "0x00000000000000000000000000000000000000bb",
      signatures: [{ signature: "imported()", type: SignatureType.Function }],
    });
    const result = await stats.getStats();
    stats.stop();

    chai.expect(result.count.function).to.equal(1000 + 3);
    chai.expect(result.count.unknown).to.equal(400);
    chai.expect(result.count.total).to.equal(1500 + 5);
  });

  it("should give a null breakdown if t0 is 6 hours old", async function () {
    baseBody = baseFile(new Date(Date.now() - 6 * HOUR_MS), BASE_COUNTS);
    const stats = createStats();
    await stats.start();

    const result = await stats.getStats();
    stats.stop();

    chai.expect(result.count.function).to.equal(null);
    chai.expect(result.count.unknown).to.equal(null);
    // From Postgres: a full count before now - 1 hour, plus the delta
    chai.expect(result.count.total).to.equal(6);
  });

  it("should give a null breakdown if there is no file", async function () {
    baseStatus = 404;
    baseBody = "Not found";
    const stats = createStats();
    await stats.start();

    const result = await stats.getStats();
    stats.stop();

    chai.expect(result.count.event).to.equal(null);
    chai.expect(result.count.total).to.equal(6);
  });

  it("should keep the last good file if a read fails or the file is not valid", async function () {
    baseBody = baseFile(new Date(Date.now() - HOUR_MS), BASE_COUNTS);
    const stats = createStats();
    await stats.start();

    baseStatus = 500;
    await stats.loadBase();
    chai.expect((await stats.getStats()).count.function).to.equal(1002);

    baseStatus = 200;
    baseBody = '{"t0":"2026-10-20T00:00:00Z","function":"many"}';
    await stats.loadBase();
    chai.expect((await stats.getStats()).count.function).to.equal(1002);

    // A file with an older t0 than the current one
    baseBody = baseFile(new Date(Date.now() - 2 * HOUR_MS), {
      ...BASE_COUNTS,
      function: 1,
    });
    await stats.loadBase();
    chai.expect((await stats.getStats()).count.function).to.equal(1002);
    stats.stop();
  });

  it("should use a newer file at the next read", async function () {
    baseBody = baseFile(new Date(Date.now() - 3 * HOUR_MS), BASE_COUNTS);
    const stats = createStats();
    await stats.start();
    // t0 is before old(), so old() is in the delta
    chai.expect((await stats.getStats()).count.total).to.equal(1500 + 6);

    baseBody = baseFile(new Date(Date.now() - HOUR_MS), {
      ...BASE_COUNTS,
      total: 2000,
    });
    await stats.loadBase();
    chai.expect((await stats.getStats()).count.total).to.equal(2000 + 5);
    stats.stop();
  });
});
