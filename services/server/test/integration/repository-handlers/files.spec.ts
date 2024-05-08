import chai from "chai";
import chaiHttp from "chai-http";
import {
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
});