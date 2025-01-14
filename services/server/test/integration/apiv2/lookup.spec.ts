import chai from "chai";
import chaiHttp from "chai-http";
import { deployAndVerifyContract } from "../../helpers/helpers";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";

chai.use(chaiHttp);

describe("API v2 lookup endpoints", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  it("should list verified contracts per chain", async function () {
    const address = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
      true, // partial match
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}`);

    chai.expect(res.status).to.equal(200);
    chai.expect(res.body.results).to.be.an.instanceOf(Array);
    chai.expect(res.body.results.length).to.equal(1);
    chai.expect(res.body.results[0]).to.include({
      match: "match",
      creationMatch: "match",
      runtimeMatch: "match",
      chainId: chainFixture.chainId,
      address,
    });
    chai.expect(res.body.results[0]).to.have.property("verifiedAt");
  });

  it("should list exact matches", async function () {
    const address = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
      false, // exact match
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}`);

    chai.expect(res.status).to.equal(200);
    chai.expect(res.body.results).to.be.an.instanceOf(Array);
    chai.expect(res.body.results.length).to.equal(1);
    chai.expect(res.body.results[0]).to.include({
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address,
    });
    chai.expect(res.body.results[0]).to.have.property("verifiedAt");
  });

  it(`should handle pagination when listing contracts`, async function () {
    const contractAddresses: string[] = [];

    // Deploy 5 contracts
    for (let i = 0; i < 5; i++) {
      const address = await deployAndVerifyContract(
        chainFixture,
        serverFixture,
        true,
      );
      contractAddresses.push(address);
    }

    // Test pagination
    const res0 = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}?page=1&limit=2`);
    chai.expect(res0.body.pagination).to.deep.equal({
      currentPage: 1,
      hasNextPage: true,
      hasPreviousPage: true,
      resultsCurrentPage: 2,
      resultsPerPage: 2,
      totalPages: 3,
      totalResults: 5,
    });
    const res1 = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}?limit=5`);
    chai.expect(res1.body.pagination).to.deep.equal({
      currentPage: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      resultsCurrentPage: 5,
      resultsPerPage: 5,
      totalPages: 1,
      totalResults: 5,
    });

    // Test ascending order
    const oldestContractsFirst = contractAddresses;
    const resAsc = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}?sort=asc`);

    chai.expect(resAsc.body.results).to.be.an.instanceOf(Array);
    chai
      .expect(resAsc.body.results.length)
      .to.equal(oldestContractsFirst.length);
    for (let i = 0; i < oldestContractsFirst.length; i++) {
      chai.expect(resAsc.body.results[i]).to.include({
        match: "match",
        creationMatch: "match",
        runtimeMatch: "match",
        chainId: chainFixture.chainId,
        address: oldestContractsFirst[i],
      });
    }

    // Test descending order
    const resDesc = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}?sort=desc`);

    const newestContractsFirst = Array.from(contractAddresses).reverse();
    chai.expect(resDesc.body.results).to.be.an.instanceOf(Array);
    chai
      .expect(resDesc.body.results.length)
      .to.equal(newestContractsFirst.length);
    for (let i = 0; i < newestContractsFirst.length; i++) {
      chai.expect(resDesc.body.results[i]).to.include({
        match: "match",
        creationMatch: "match",
        runtimeMatch: "match",
        chainId: chainFixture.chainId,
        address: newestContractsFirst[i],
      });
    }
  });

  it("should return a 404 when the chain is not found", async function () {
    const unknownChainId = "5";

    // Make sure chain is not found
    const chainMap = serverFixture.server.chainRepository.sourcifyChainMap;
    const chainToRestore = chainMap[unknownChainId];
    delete chainMap[unknownChainId];

    const res = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${unknownChainId}`);

    chai.expect(res.status).to.equal(404);
    chai.expect(res.body.customCode).to.equal("unsupported_chain");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");

    // Restore chain
    chainMap[unknownChainId] = chainToRestore;
  });
});
