process.env.TESTING = true;
process.env.LOCALCHAIN_URL = "http://localhost:8545";
process.env.MOCK_REPOSITORY = './dist/data/mock-repository';
process.env.MOCK_DATABASE = './dist/data/mock-database';

const chai = require("chai");
const chaiHttp = require("chai-http");
const Server = require("../dist/server/server").Server;
const util = require("util");
const fs = require("fs");
const rimraf = require("rimraf");
const path = require("path");
const MAX_INPUT_SIZE = require("../dist/server/controllers/VerificationController").default.MAX_INPUT_SIZE;
chai.use(chaiHttp);

const EXTENDED_TIME = 15000; // 15 seconds

describe("Server", async () => {
    const server = new Server();
    const promisified = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Injector listening on port ${server.port}!`);

    beforeEach(() => {
        rimraf.sync(process.env.MOCK_REPOSITORY);
    });

    after(() => {
        rimraf.sync(process.env.MOCK_REPOSITORY);
    });

    const sourcePath = path.join("test", "testcontracts", "1_Storage", "1_Storage.sol");
    const sourceBuffer = fs.readFileSync(sourcePath);
    const metadataPath = path.join("test", "testcontracts", "1_Storage", "metadata.json");
    const metadataBuffer = fs.readFileSync(metadataPath);
    const contractChain = "100"; // xdai
    const contractAddress = "0x656d0062eC89c940213E3F3170EA8b2add1c0143";
    const fakeAddress = "0x656d0062eC89c940213E3F3170EA8b2add1c0142"

    const assertError = (err, res, field) => {
        chai.expect(err).to.be.null;
        chai.expect(res.status).to.equal(400);
        chai.expect(res.body.message.startsWith("Validation Error"));
        chai.expect(res.body.errors).to.be.an("array");
        chai.expect(res.body.errors).to.have.a.lengthOf(1);
        chai.expect(res.body.errors[0].field).to.equal(field);
    }

    describe("/check-by-addresses", () => {
        it("should fail for missing chainIds", (done) => {
            chai.request(server.app)
                .get("/check-by-addresses")
                .query({ addresses: contractAddress })
                .end((err, res) => {
                    assertError(err, res, "chainIds");
                    done();
                });
        });

        it("should fail for missing addresses", (done) => {
            chai.request(server.app)
                .get("/check-by-addresses")
                .query({ chainIds: 1 })
                .end((err, res) => {
                    assertError(err, res, "addresses");
                    done();
                });
        }).timeout(EXTENDED_TIME);

        const assertStatus = (err, res, expectedStatus, done) => {
            chai.expect(err).to.be.null;
            chai.expect(res.status).to.equal(200);
            const resultArray = res.body;
            chai.expect(resultArray).to.have.a.lengthOf(1);
            const result = resultArray[0];
            chai.expect(result.address).to.equal(contractAddress);
            chai.expect(result.status).to.equal(expectedStatus);
            if (done) done();
        }

        it("should return false for previously unverified contract", (done) => {
            chai.request(server.app)
                .get("/check-by-Addresses")
                .query({ chainIds: 100, addresses: contractAddress })
                .end((err, res) => assertStatus(err, res, "false", done));
        }).timeout(EXTENDED_TIME);

        it("should fail for invalid address", (done) => {
            chai.request(server.app)
                .get("/check-by-addresses")
                .query({ chainIds: contractChain, addresses: fakeAddress })
                .end((err, res) => {
                    assertError(err, res, "addresses");
                    done();
                });
        }).timeout(EXTENDED_TIME);

        it("should return true for previously verified contract", (done) => {
            chai.request(server.app)
                .get("/check-by-addresses")
                .query({ chainIds: 100, addresses: contractAddress })
                .end((err, res) => {
                    assertStatus(err, res, "false");
                    chai.request(server.app).post("/")
                        .field("address", contractAddress)
                        .field("chain", contractChain)
                        .attach("files", metadataBuffer, "metadata.json")
                        .attach("files", sourceBuffer)
                        .end((err, res) => {
                            chai.expect(err).to.be.null;
                            chai.expect(res.status).to.equal(200);

                            chai.request(server.app)
                                .get("/check-by-addresses")
                                .query({ chainIds: 100, addresses: contractAddress })
                                .end((err, res) => assertStatus(err, res, "perfect", done));
                        });     
                });
        }).timeout(EXTENDED_TIME);
    });

    const checkNonVerified = (path, done) => {
        chai.request(server.app)
                .post(path)
                .field("chain", contractChain)
                .field("address", contractAddress)
                .end((err, res) => {
                    chai.expect(err).to.be.null;
                    chai.expect(res.body).to.haveOwnProperty("error");
                    chai.expect(res.status).to.equal(404);
                    done();
                });
    }

    describe("/", () => {
        it("should correctly inform for an address check of a non verified contract (at /)", (done) => {
            checkNonVerified("/", done);
        }).timeout(EXTENDED_TIME);

        it("should correctly inform for an address check of a non verified contract (at /verify)", (done) => {
            checkNonVerified("/verify", done);
        }).timeout(EXTENDED_TIME);

        const assertions = (err, res, done) => {
            chai.expect(err).to.be.null;
            chai.expect(res.status).to.equal(200);
            chai.expect(res.body).to.haveOwnProperty("result");
            const resultArr = res.body.result;
            chai.expect(resultArr).to.have.a.lengthOf(1);
            const result = resultArr[0];
            chai.expect(result.address).to.equal(contractAddress);
            chai.expect(result.status).to.equal("perfect");
            done();
        }

        it("should verify multipart upload", (done) => {
            chai.request(server.app)
                .post("/")
                .field("address", contractAddress)
                .field("chain", contractChain)
                .attach("files", metadataBuffer, "metadata.json")
                .attach("files", sourceBuffer, "1_Storage.sol")
                .end((err, res) => assertions(err, res, done));
        }).timeout(EXTENDED_TIME);

        it("should verify json upload with string properties", (done) => {
            chai.request(server.app)
                .post("/")
                .send({
                    address: contractAddress,
                    chain: contractChain,
                    files: {
                        "metadata.json": metadataBuffer.toString(),
                        "1_Storage.sol": sourceBuffer.toString()
                    }
                })
                .end((err, res) => assertions(err, res, done));
        }).timeout(EXTENDED_TIME);

        it("should verify json upload with Buffer properties", (done) => {
            chai.request(server.app)
                .post("/")
                .send({
                    address: contractAddress,
                    chain: contractChain,
                    files: {
                        "metadata.json": metadataBuffer,
                        "1_Storage.sol": sourceBuffer
                    }
                })
                .end((err, res) => assertions(err, res, done));
        }).timeout(EXTENDED_TIME);

        it("should return Internal Server Error for missing file", (done) => {
            chai.request(server.app)
                .post("/")
                .field("address", contractAddress)
                .field("chain", contractChain)
                .attach("files", metadataBuffer, "metadata.json")
                .end((err, res) => {
                    chai.expect(err).to.be.null;
                    chai.expect(res.body).to.haveOwnProperty("error");
                    const errorMessage = res.body.error.toLowerCase();
                    chai.expect(res.status).to.equal(500);
                    chai.expect(errorMessage).to.include("missing");
                    chai.expect(errorMessage).to.include("1_Storage.sol".toLowerCase());
                    done();
                });
        }).timeout(EXTENDED_TIME);
    });

    describe("verification v2", () => {
        it("should inform when no pending contracts", (done) => {
            chai.request(server.app)
                .post("/verify-validated")
                .end((err, res) => {
                    chai.expect(err).to.be.null;
                    chai.expect(res.body).to.haveOwnProperty("error");
                    chai.expect(res.status).to.equal(400);
                    chai.expect(res.body.error).to.equal("There are currently no pending contracts.")
                    done();
                });
        }).timeout(EXTENDED_TIME);

        it("should not verify after addition of metadata+source, but should after providing address+networkId", (done) => {
            const agent = chai.request.agent(server.app);
            agent.post("/input-files")
                .attach("files", sourceBuffer, "1_Storage.sol")
                .attach("files", metadataBuffer, "metadata.json")
                .then(res => {
                    chai.expect(res.status).to.equal(200);
                    const contracts = res.body.contracts;
                    chai.expect(contracts).to.have.a.lengthOf(1);
                    const contract = contracts[0];
                    chai.expect(contract.status).to.equal("error");
                    chai.expect(res.body.unused).to.be.empty;
                    contract.address = contractAddress;
                    contract.networkId = contractChain;

                    agent.post("/verify-validated")
                        .send({ contracts })
                        .end((err, res) => {
                            chai.expect(err).to.be.null;
                            chai.expect(res.status).to.equal(200);
                            const contracts = res.body.contracts;
                            chai.expect(contracts).to.have.a.lengthOf(1);
                            const contract = contracts[0];
                            chai.expect(contract.status).to.equal("perfect");
                            chai.expect(!contract.storageTimestamp);
                            chai.expect(res.body.unused).to.be.empty;
                            done();
                        });
            });
        }).timeout(EXTENDED_TIME);

        const assertAfterMetadataUpload = (err, res) => {
            chai.expect(err).to.be.null;
            chai.expect(res.status).to.equal(200);
            chai.expect(res.body.unused).to.be.empty;

            const contracts = res.body.contracts;
            chai.expect(contracts).to.have.a.lengthOf(1);
            const contract = contracts[0];

            chai.expect(contract.name).to.equal("Storage");
            chai.expect(contract.status).to.equal("error");
        }

        it("should not verify when session cookie not stored clientside", (done) => {
            chai.request(server.app)
                .post("/input-files")
                .attach("files", metadataBuffer, "metadata.json")
                .end((err, res) => {
                    assertAfterMetadataUpload(err, res);

                    chai.request(server.app)
                        .post("/input-files")
                        .attach("files", sourceBuffer, "1_Storage.sol")
                        .end((err, res) => {
                            chai.expect(err).to.be.null;
                            chai.expect(res.status).to.equal(200);

                            chai.expect(res.body.unused).to.deep.equal(["1_Storage.sol"]);
                            chai.expect(res.body.contracts).to.be.empty;
                            done();
                        });
                });
        }).timeout(EXTENDED_TIME);

        const assertAllFound = (err, res, finalStatus) => {
            chai.expect(err).to.be.null;
            chai.expect(res.status).to.equal(200);
            chai.expect(res.body.unused).to.be.empty;

            const contracts = res.body.contracts;
            chai.expect(contracts).to.have.a.lengthOf(1);
            const contract = contracts[0];

            chai.expect(contract.name).to.equal("Storage");
            chai.expect(contract.status).to.equal(finalStatus);
            chai.expect(!contract.storageTimestamp);
        }

        it("should verify when session cookie stored clientside", (done) => {
            const agent = chai.request.agent(server.app);
            agent.post("/input-files")
                .attach("files", metadataBuffer, "metadata.json")
                .end((err, res) => {
                    assertAfterMetadataUpload(err, res);
                    const contracts = res.body.contracts;

                    agent.post("/input-files")
                        .attach("files", sourceBuffer, "1_Storage.sol")
                        .end((err, res) => {
                            contracts[0].networkId = contractChain;
                            contracts[0].address = contractAddress;
                            assertAllFound(err, res, "error");

                            agent.post("/verify-validated")
                                .send({ contracts })
                                .end((err, res) => {
                                    assertAllFound(err, res, "perfect");
                                    done();
                                });
                        });
                });
        }).timeout(EXTENDED_TIME);

        it("should fail if too many files uploaded, but should succeed after deletion", (done) => {
            const agent = chai.request.agent(server.app);

            const file = "a".repeat(MAX_INPUT_SIZE);
            agent.post("/input-files")
                .attach("files", Buffer.from(file))
                .then(res => {
                    chai.expect(res.status).to.equal(200);

                    agent.post("/input-files")
                        .attach("files", Buffer.from("a"))
                        .then(res => {
                            chai.expect(res.status).to.equal(413);
                            chai.expect(res.body.error);

                            agent.post("/restart-session")
                                .then(res => {
                                    chai.expect(res.status).to.equal(200);

                                    agent.post("/input-files")
                                        .attach("files", Buffer.from("a"))
                                        .then(res => {
                                            chai.expect(res.status).to.equal(200);
                                            done();
                                        });
                                });
                        });
                }); 
        }).timeout(EXTENDED_TIME);

        const assertSingleContractStatus = (res, expectedStatus, shouldHaveTimestamp) => {
            chai.expect(res.status).to.equal(200);
            chai.expect(res.body).to.haveOwnProperty("contracts");
            const contracts = res.body.contracts;
            chai.expect(contracts).to.have.a.lengthOf(1);
            const contract = contracts[0];
            chai.expect(contract.status).to.equal(expectedStatus);
            chai.expect(Boolean(contract.storageTimestamp) == Boolean(shouldHaveTimestamp));
            return contracts;
        }

        it("should verify after providing address and then network; should provide timestamp when verifying again", (done) => {
            const agent = chai.request.agent(server.app);
            agent.post("/input-files")
                .attach("files", sourceBuffer)
                .attach("files", metadataBuffer)
                .then(res => {
                    const contracts = assertSingleContractStatus(res, "error");
                    contracts[0].address = contractAddress;

                    agent.post("/verify-validated")
                        .send({ contracts })
                        .then(res => {
                            assertSingleContractStatus(res, "error");
                            contracts[0].networkId = contractChain;

                            agent.post("/verify-validated")
                                .send({ contracts })
                                .then(res => {
                                    assertSingleContractStatus(res, "perfect");
                                    
                                    agent.post("/verify-validated")
                                        .send({ contracts })
                                        .then(res => {
                                            assertSingleContractStatus(res, "perfect", true);
                                            done();
                                        })
                                });
                        });
                });
        }).timeout(EXTENDED_TIME);
    });
});