import chai from "chai";
import chaiHttp from "chai-http";
import {
  deployFromAbiAndBytecodeForCreatorTxHash,
  waitSecs,
} from "../../helpers/helpers";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";

chai.use(chaiHttp);

describe("Verify repository endpoints", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  it("should fetch files of specific address", async function () {
    const agent = chai.request.agent(serverFixture.server.app);
    // Wait for the server to complete the previous contract verification
    await waitSecs(1);
    await agent
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach("files", chainFixture.defaultContractMetadata, "metadata.json")
      .attach("files", chainFixture.defaultContractSource, "Storage.sol");
    const res0 = await agent.get(
      `/files/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`
    );
    chai.expect(res0.body).has.a.lengthOf(2);
    const res1 = await agent.get(
      `/files/tree/any/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`
    );
    chai.expect(res1.body?.status).equals("full");
    const res2 = await agent.get(
      `/files/any/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`
    );
    chai.expect(res2.body?.status).equals("full");
    const res3 = await agent.get(
      `/files/tree/${chainFixture.chainId}/${chainFixture.defaultContractAddress}`
    );
    chai.expect(res3.body).has.a.lengthOf(2);
    const res4 = await agent.get(`/files/contracts/${chainFixture.chainId}`);
    chai.expect(res4.body.full).has.a.lengthOf(1);
  });

  it("should handle pagination in /files/contracts/{chain}", async function () {
    for (let i = 0; i < 5; i++) {
      const { contractAddress } =
        await deployFromAbiAndBytecodeForCreatorTxHash(
          chainFixture.localSigner,
          chainFixture.defaultContractArtifact.abi,
          chainFixture.defaultContractArtifact.bytecode,
          []
        );
      await chai
        .request(serverFixture.server.app)
        .post("/")
        .field("address", contractAddress)
        .field("chain", chainFixture.chainId)
        .attach("files", chainFixture.defaultContractMetadata, "metadata.json")
        .attach("files", chainFixture.defaultContractSource);
    }
    const res0 = await chai
      .request(serverFixture.server.app)
      .get(`/files/contracts/any/${chainFixture.chainId}?page=1&limit=2`);
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
      .get(`/files/contracts/any/${chainFixture.chainId}?limit=5`);
    chai.expect(res1.body.pagination).to.deep.equal({
      currentPage: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      resultsCurrentPage: 5,
      resultsPerPage: 5,
      totalPages: 1,
      totalResults: 5,
    });
  });
});
