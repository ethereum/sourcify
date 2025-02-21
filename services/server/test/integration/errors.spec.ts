import chai from "chai";
import chaiHttp from "chai-http";
import { ServerFixture } from "../helpers/ServerFixture";

chai.use(chaiHttp);

describe("Error handling", function () {
  const serverFixture = new ServerFixture();

  it("should return a 404 on unknown routes", async function () {
    const res = await chai.request(serverFixture.server.app).get("/unknown");
    chai.expect(res.status).equals(404);
    chai.expect(res.body.customCode).to.equal("route_not_found");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");
  });

  it("should return a 404 on unknown methods on known routes", async function () {
    const res = await chai
      .request(serverFixture.server.app)
      .post("/v2/contracts/1");
    chai.expect(res.status).equals(404);
    chai.expect(res.body.customCode).to.equal("route_not_found");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");
  });
});
