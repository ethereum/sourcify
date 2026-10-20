import chai from "chai";
import { parseSignatureStatsBase } from "../../src/SignatureStats";

describe("parseSignatureStatsBase", function () {
  it("should parse the BigQuery JSON export", function () {
    const base = parseSignatureStatsBase(
      '{"t0":"2026-10-20T09:25:49.227193Z","function":"4906592","event":"1199357","error":"556949","unknown":"3951695","total":"10600577"}\n',
    );
    chai.expect(base).to.deep.equal({
      t0: new Date("2026-10-20T09:25:49.227Z"),
      function: 4906592,
      event: 1199357,
      error: 556949,
      unknown: 3951695,
      total: 10600577,
    });
  });

  it("should accept numbers", function () {
    const base = parseSignatureStatsBase(
      '{"t0":"2026-10-20T00:00:00Z","function":1,"event":2,"error":3,"unknown":4,"total":10}',
    );
    chai.expect(base.total).to.equal(10);
  });

  it("should reject files that are not valid", function () {
    const valid = {
      t0: "2026-10-20T00:00:00Z",
      function: "1",
      event: "2",
      error: "3",
      unknown: "4",
      total: "10",
    };
    const cases = [
      "",
      "\n\n",
      "not json",
      JSON.stringify({ ...valid, t0: "yesterday" }),
      JSON.stringify({ ...valid, t0: 1760918400000 }),
      JSON.stringify({ ...valid, function: undefined }),
      JSON.stringify({ ...valid, event: "-1" }),
      JSON.stringify({ ...valid, error: "1.5" }),
      JSON.stringify({ ...valid, total: "" }),
      JSON.stringify({ ...valid, total: null }),
    ];
    for (const text of cases) {
      chai.expect(() => parseSignatureStatsBase(text), text).to.throw();
    }
  });
});
