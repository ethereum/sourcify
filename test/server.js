process.env.TESTING = true;
process.env.LOCALCHAIN_URL = "http://localhost:8545";
process.env.MOCK_REPOSITORY = "./dist/data/mock-repository";
process.env.MOCK_DATABASE = "./dist/data/mock-database";
process.env.SOLC_REPO = "./dist/data/solc-repo";
process.env.SOLJSON_REPO = "/dist/data/soljson-repo";

const chai = require("chai");
const chaiHttp = require("chai-http");
const Server = require("../dist/server/server").Server;
const util = require("util");
const fs = require("fs");
const rimraf = require("rimraf");
const path = require("path");
const MAX_INPUT_SIZE =
  require("../dist/server/controllers/VerificationController").default
    .MAX_INPUT_SIZE;
const StatusCodes = require("http-status-codes").StatusCodes;
const { waitSecs } = require("./helpers/helpers");
const Web3EthAbi = require("web3-eth-abi");
chai.use(chaiHttp);

const binaryParser = function (res, cb) {
  res.setEncoding("binary");
  res.data = "";
  res.on("data", (chunk) => (res.data += chunk));
  res.on("end", () => cb(null, Buffer.from(res.data, "binary")));
};

const EXTENDED_TIME = 20000; // 20 seconds

const foundContractChain = {
  chainId: "5",
  status: "perfect",
};

describe("Server", function () {
  const server = new Server();

  before(async () => {
    const promisified = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Injector listening on port ${server.port}!`);
  });

  beforeEach(() => {
    rimraf.sync(server.repository);
  });

  after(() => {
    rimraf.sync(server.repository);
  });

  const sourcePath = path.join(
    "test",
    "testcontracts",
    "1_Storage",
    "1_Storage.sol"
  );
  const sourceBuffer = fs.readFileSync(sourcePath);

  const metadataPath = path.join(
    "test",
    "testcontracts",
    "1_Storage",
    "metadata.json"
  );
  const metadataBuffer = fs.readFileSync(metadataPath);
  const metadata = JSON.parse(metadataBuffer.toString());
  const ipfsAddress = metadata.sources["browser/1_Storage.sol"].urls[1];

  // change the last char in ipfs hash of the source file
  const lastChar = ipfsAddress.charAt(ipfsAddress.length - 1);
  const modifiedLastChar = lastChar === "a" ? "b" : "a";
  const modifiedIpfsAddress =
    ipfsAddress.slice(0, ipfsAddress.length - 1) + modifiedLastChar;
  metadata.sources["browser/1_Storage.sol"].urls[1] = modifiedIpfsAddress;
  const modifiedMetadataBuffer = Buffer.from(JSON.stringify(metadata));

  const contractChain = "5"; // goerli
  const contractAddress = "0x000000bCB92160f8B7E094998Af6BCaD7fa537fe";
  const fakeAddress = "0x000000bCB92160f8B7E094998Af6BCaD7fa537ff";
  const hardhatOutput = {
    chain: "5",
    address: "0x1EFFEbE8B0bc20f2Dc504AA16dC76FF1AB2297A3",
    mainContractIndex: 5,
  };

  const assertError = (err, res, field) => {
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
    chai.expect(res.body.message.startsWith("Validation Error")).to.be.true;
    chai.expect(res.body.errors).to.be.an("array");
    chai.expect(res.body.errors).to.have.a.lengthOf(1);
    chai.expect(res.body.errors[0].field).to.equal(field);
  };

  const assertions = (
    err,
    res,
    done,
    expectedAddress = contractAddress,
    expectedStatus = "perfect"
  ) => {
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.OK);
    chai.expect(res.body).to.haveOwnProperty("result");
    const resultArr = res.body.result;
    chai.expect(resultArr).to.have.a.lengthOf(1);
    const result = resultArr[0];
    chai.expect(result.address).to.equal(expectedAddress);
    chai.expect(result.status).to.equal(expectedStatus);
    if (done) done();
  };

  describe("/check-by-addresses", function () {
    this.timeout(EXTENDED_TIME);

    it("should fail for missing chainIds", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ addresses: contractAddress })
        .end((err, res) => {
          assertError(err, res, "chainIds");
          done();
        });
    });

    it("should fail for missing addresses", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ chainIds: 1 })
        .end((err, res) => {
          assertError(err, res, "addresses");
          done();
        });
    });

    const assertStatus = (err, res, expectedStatus, expectedChainIds, done) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);
      const resultArray = res.body;
      chai.expect(resultArray).to.have.a.lengthOf(1);
      const result = resultArray[0];
      chai.expect(result.address).to.equal(contractAddress);
      chai.expect(result.status).to.equal(expectedStatus);
      chai.expect(result.chainIds).to.deep.equal(expectedChainIds);
      if (done) done();
    };

    it("should return false for previously unverified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ chainIds: contractChain, addresses: contractAddress })
        .end((err, res) => assertStatus(err, res, "false", undefined, done));
    });

    it("should fail for invalid address", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ chainIds: contractChain, addresses: fakeAddress })
        .end((err, res) => {
          assertError(err, res, "addresses");
          done();
        });
    });

    it("should return true for previously verified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ chainIds: contractChain, addresses: contractAddress })
        .end((err, res) => {
          assertStatus(err, res, "false", undefined);
          chai
            .request(server.app)
            .post("/")
            .field("address", contractAddress)
            .field("chain", contractChain)
            .attach("files", metadataBuffer, "metadata.json")
            .attach("files", sourceBuffer)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);

              chai
                .request(server.app)
                .get("/check-by-addresses")
                .query({ chainIds: contractChain, addresses: contractAddress })
                .end((err, res) =>
                  assertStatus(err, res, "perfect", [contractChain], done)
                );
            });
        });
    });

    it("should convert addresses to checksummed format", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({
          chainIds: contractChain,
          addresses: contractAddress.toLowerCase(),
        })
        .end((err, res) => {
          chai.expect(err).to.be.null;
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body).to.have.a.lengthOf(1);
          const result = res.body[0];
          chai.expect(result.address).to.equal(contractAddress);
          chai.expect(result.status).to.equal("false");
          done();
        });
    });
  });

  describe("/check-all-by-addresses", function () {
    this.timeout(EXTENDED_TIME);

    it("should fail for missing chainIds", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ addresses: contractAddress })
        .end((err, res) => {
          assertError(err, res, "chainIds");
          done();
        });
    });

    it("should fail for missing addresses", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ chainIds: 1 })
        .end((err, res) => {
          assertError(err, res, "addresses");
          done();
        });
    });

    const assertStatus = (err, res, expectedStatus, expectedChainIds, done) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);
      const resultArray = res.body;
      chai.expect(resultArray).to.have.a.lengthOf(1);
      const result = resultArray[0];
      chai.expect(result.address).to.equal(contractAddress);
      chai.expect(result.status).to.equal(expectedStatus);
      chai.expect(result.chainIds).to.deep.equal(expectedChainIds);
      if (done) done();
    };

    it("should return false for previously unverified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ chainIds: contractChain, addresses: contractAddress })
        .end((err, res) => assertStatus(err, res, "false", undefined, done));
    });

    it("should fail for invalid address", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ chainIds: contractChain, addresses: fakeAddress })
        .end((err, res) => {
          assertError(err, res, "addresses");
          done();
        });
    });

    it("should return true for previously verified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ chainIds: contractChain, addresses: contractAddress })
        .end((err, res) => {
          assertStatus(err, res, "false", undefined);
          chai
            .request(server.app)
            .post("/")
            .field("address", contractAddress)
            .field("chain", contractChain)
            .attach("files", metadataBuffer, "metadata.json")
            .attach("files", sourceBuffer)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);

              chai
                .request(server.app)
                .get("/check-all-by-addresses")
                .query({ chainIds: contractChain, addresses: contractAddress })
                .end((err, res) =>
                  assertStatus(err, res, undefined, [foundContractChain], done)
                );
            });
        });
    });

    it("should convert addresses to checksummed format", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({
          chainIds: contractChain,
          addresses: contractAddress.toLowerCase(),
        })
        .end((err, res) => {
          chai.expect(err).to.be.null;
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body).to.have.a.lengthOf(1);
          const result = res.body[0];
          chai.expect(result.address).to.equal(contractAddress);
          chai.expect(result.status).to.equal("false");
          done();
        });
    });
  });

  const checkNonVerified = (path, done) => {
    chai
      .request(server.app)
      .post(path)
      .field("chain", contractChain)
      .field("address", contractAddress)
      .end((err, res) => {
        chai.expect(err).to.be.null;
        chai.expect(res.body).to.haveOwnProperty("error");
        chai.expect(res.status).to.equal(StatusCodes.NOT_FOUND);
        done();
      });
  };

  describe("/", function () {
    this.timeout(EXTENDED_TIME);

    it("should correctly inform for an address check of a non verified contract (at /)", (done) => {
      checkNonVerified("/", done);
    });

    it("should correctly inform for an address check of a non verified contract (at /verify)", (done) => {
      checkNonVerified("/verify", done);
    });

    it("should verify multipart upload", (done) => {
      chai
        .request(server.app)
        .post("/")
        .field("address", contractAddress)
        .field("chain", contractChain)
        .attach("files", metadataBuffer, "metadata.json")
        .attach("files", sourceBuffer, "1_Storage.sol")
        .end((err, res) => assertions(err, res, done));
    });

    it("should verify json upload with string properties", (done) => {
      chai
        .request(server.app)
        .post("/")
        .send({
          address: contractAddress,
          chain: contractChain,
          files: {
            "metadata.json": metadataBuffer.toString(),
            "1_Storage.sol": sourceBuffer.toString(),
          },
        })
        .end((err, res) => assertions(err, res, done));
    });

    it("should verify json upload with Buffer properties", (done) => {
      chai
        .request(server.app)
        .post("/")
        .send({
          address: contractAddress,
          chain: contractChain,
          files: {
            "metadata.json": metadataBuffer,
            "1_Storage.sol": sourceBuffer,
          },
        })
        .end((err, res) => assertions(err, res, done));
    });

    const assertMissingFile = (err, res) => {
      chai.expect(err).to.be.null;
      chai.expect(res.body).to.haveOwnProperty("error");
      const errorMessage = res.body.error.toLowerCase();
      chai.expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
      chai.expect(errorMessage).to.include("missing");
      chai.expect(errorMessage).to.include("Storage".toLowerCase());
    };

    it("should return Bad Request Error for a source that is missing and unfetchable", (done) => {
      chai
        .request(server.app)
        .post("/")
        .field("address", contractAddress)
        .field("chain", contractChain)
        .attach("files", modifiedMetadataBuffer, "metadata.json")
        .end((err, res) => {
          assertMissingFile(err, res);
          done();
        });
    });

    it("should fetch a missing file that is accessible via ipfs", (done) => {
      chai
        .request(server.app)
        .post("/")
        .field("address", contractAddress)
        .field("chain", contractChain)
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => assertions(err, res, done));
    });

    it("should verify a contract with immutables on Matic Testnet Mumbai (also with libraries)", (done) => {
      const address = "0x7c90F0C9Eb46391c93d0545dDF4658d3B8DF1866";
      const metadataPath = path.join(
        "test",
        "sources",
        "metadata",
        "with-immutables-and-libraries.meta.object.json"
      );
      const metadataBuffer = fs.readFileSync(metadataPath);
      chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", "80001")
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => assertions(err, res, done, address));
    });

    const verifyContractWithImmutables = (
      address,
      chainId,
      chainName,
      ctorArg,
      metadataFileName = "withImmutables.meta.object.json"
    ) => {
      it(`should verify a contract with immutables on ${chainName}`, (done) => {
        const sourcePath = path.join(
          "test",
          "sources",
          "contracts",
          "WithImmutables.sol"
        );
        const sourceBuffer = fs.readFileSync(sourcePath);
        const metadataPath = path.join(
          "test",
          "sources",
          "metadata",
          metadataFileName
        );
        const metadataBuffer = fs.readFileSync(metadataPath);
        chai
          .request(server.app)
          .post("/")
          .field("address", address)
          .field("chain", chainId)
          .attach("files", metadataBuffer, "metadata.json")
          .attach("files", sourceBuffer, "WithImmutables.sol")
          .end((err, res) => {
            assertions(err, res, null, address);

            chai
              .request(server.app)
              .get(
                `/repository/contracts/full_match/${chainId}/${address}/constructor-args.txt`
              )
              .buffer()
              .parse(binaryParser)
              .end((err, res) => {
                chai.expect(err).to.be.null;
                chai.expect(res.status).to.equal(StatusCodes.OK);
                const encodedParameter = Web3EthAbi.encodeParameter(
                  "uint256",
                  ctorArg
                );
                chai.expect(res.body.toString()).to.equal(encodedParameter);
                done();
              });
          });
      });
    };

    verifyContractWithImmutables(
      "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
      "3",
      "Ropsten",
      987
    );

    verifyContractWithImmutables(
      "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
      "4",
      "Rinkeby",
      101
    );

    verifyContractWithImmutables(
      "0xBdDe4D595F2CDdA92ca274423374E0e1C7286426",
      "5",
      "Goerli",
      2
    );

    verifyContractWithImmutables(
      "0x443C64AcC4c6dB358Eb1CA78fdf7577C2a7eA499",
      "42",
      "Kovan",
      256
    );

    verifyContractWithImmutables(
      "0x3CE1a25376223695284edc4C2b323C3007010C94",
      "100",
      "xDai",
      123
    );

    verifyContractWithImmutables(
      "0x66ec3fBf4D7d7B7483Ae4fBeaBDD6022037bfa1a",
      "44787",
      "Alfajores Celo",
      777
    );

    verifyContractWithImmutables(
      "0xD222286c59c0B9c8D06Bac42AfB7B8CB153e7Bf7",
      "77",
      "Sokol",
      1234,
      "withImmutables2.meta.object.json"
    );

    verifyContractWithImmutables(
      "0x84d9eF98bF8a66bfB6ed8383F340C402507CfC15",
      "421611",
      "Arbitrum Rinkeby",
      42,
      "withImmutables2.meta.object.json"
    );

    it("should return 'partial', then delete partial when 'full' match", (done) => {
      const partialMetadataPath = path.join(
        "test",
        "testcontracts",
        "1_Storage",
        "metadata-modified.json"
      );
      const partialMetadataBuffer = fs.readFileSync(partialMetadataPath);

      const partialSourcePath = path.join(
        "test",
        "testcontracts",
        "1_Storage",
        "1_Storage-modified.sol"
      );
      const partialSourceBuffer = fs.readFileSync(partialSourcePath);

      const partialMetadataURL = `/repository/contracts/partial_match/${contractChain}/${contractAddress}/metadata.json`;
      const partialMetadata = JSON.parse(partialMetadataBuffer.toString());

      chai
        .request(server.app)
        .post("/")
        .field("address", contractAddress)
        .field("chain", contractChain)
        .attach("files", partialMetadataBuffer, "metadata.json")
        .attach("files", partialSourceBuffer)
        .end((err, res) => {
          assertions(err, res, null, contractAddress, "partial");

          chai
            .request(server.app)
            .get(partialMetadataURL)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.body).to.deep.equal(partialMetadata);

              chai
                .request(server.app)
                .post("/")
                .field("address", contractAddress)
                .field("chain", contractChain)
                .attach("files", metadataBuffer, "metadata.json")
                .attach("files", sourceBuffer)
                .end(async (err, res) => {
                  assertions(err, res, null, contractAddress);

                  await waitSecs(2); // allow server some time to execute the deletion (it started *after* the last response)
                  chai
                    .request(server.app)
                    .get(partialMetadataURL)
                    .end((err, res) => {
                      chai.expect(err).to.be.null;
                      chai.expect(res.status).to.equal(StatusCodes.NOT_FOUND);
                      done();
                    });
                });
            });
        });
    });

    it("should mark contracts without an embedded metadata hash as a 'partial' match", (done) => {
      const address = "0x093203902B71Cdb1dAA83153b3Df284CD1a2f88d";
      const metadataPath = path.join(
        "test",
        "sources",
        "metadata",
        "withoutMetadataHash.meta.object.json"
      );
      const metadataBuffer = fs.readFileSync(metadataPath);
      chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", "5")
        .attach("files", metadataBuffer)
        .end((err, res) => assertions(err, res, done, address, "partial"));
    });

    it("should verify a contract with library placeholders", (done) => {
      const chainId = "5";
      const address = "0x399B23c75d8fd0b95E81E41e1c7c88937Ee18000";

      const metadataPath = path.join(
        "test",
        "sources",
        "metadata",
        "using-library.meta.object.json"
      );
      const metadataBuffer = fs.readFileSync(metadataPath);

      const sourcePath = path.join(
        "test",
        "sources",
        "contracts",
        "UsingLibrary.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", chainId)
        .attach("files", metadataBuffer)
        .attach("files", sourceBuffer)
        .end((err, res) => {
          assertions(err, res, null, address, "perfect");
          chai
            .request(server.app)
            .get(
              `/repository/contracts/full_match/${chainId}/${address}/library-map.json`
            )
            .buffer()
            .parse(binaryParser)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);
              const receivedLibraryMap = JSON.parse(res.body.toString());
              const expectedLibraryMap = {
                __$da572ae5e60c838574a0f88b27a0543803$__:
                  "11fea6722e00ba9f43861a6e4da05fecdf9806b7",
              };
              chai.expect(receivedLibraryMap).to.deep.equal(expectedLibraryMap);
              done();
            });
        });
    });
  });

  describe("verification v2", function () {
    this.timeout(EXTENDED_TIME);

    it("should inform when no pending contracts", (done) => {
      chai
        .request(server.app)
        .post("/verify-validated")
        .end((err, res) => {
          chai.expect(err).to.be.null;
          chai.expect(res.body).to.haveOwnProperty("error");
          chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
          chai
            .expect(res.body.error)
            .to.equal("There are currently no pending contracts.");
          done();
        });
    });

    const assertAddressAndChainMissing = (
      res,
      expectedFound,
      expectedMissing
    ) => {
      chai.expect(res.status).to.equal(StatusCodes.OK);
      const contracts = res.body.contracts;
      chai.expect(contracts).to.have.a.lengthOf(1);

      const contract = contracts[0];
      chai.expect(contract.status).to.equal("error");
      chai.expect(contract.files.missing).to.deep.equal(expectedMissing);
      chai.expect(contract.files.found).to.deep.equal(expectedFound);
      chai.expect(res.body.unused).to.be.empty;
      chai.expect(contract.storageTimestamp).to.equal(undefined);
      return contracts;
    };

    it("should accept file upload in JSON format", (done) => {
      chai
        .request(server.app)
        .post("/input-files")
        .send({
          files: {
            "metadata.json": metadataBuffer.toString(),
            "1_Storage.sol": sourceBuffer.toString(),
          },
        })
        .then((res) => {
          assertAddressAndChainMissing(res, ["browser/1_Storage.sol"], []);
          done();
        });
    });

    it("should not verify after addition of metadata+source, but should after providing address+chainId", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", sourceBuffer, "1_Storage.sol")
        .attach("files", metadataBuffer, "metadata.json")
        .then((res) => {
          const contracts = assertAddressAndChainMissing(
            res,
            ["browser/1_Storage.sol"],
            []
          );
          contracts[0].address = contractAddress;
          contracts[0].chainId = contractChain;

          agent
            .post("/verify-validated")
            .send({ contracts })
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);
              const contracts = res.body.contracts;
              chai.expect(contracts).to.have.a.lengthOf(1);
              const contract = contracts[0];
              chai.expect(contract.status).to.equal("perfect");
              chai.expect(contract.storageTimestamp).to.not.exist;
              chai.expect(res.body.unused).to.be.empty;
              done();
            });
        });
    });

    const assertAfterMetadataUpload = (err, res) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);
      chai.expect(res.body.unused).to.be.empty;

      const contracts = res.body.contracts;
      chai.expect(contracts).to.have.a.lengthOf(1);
      const contract = contracts[0];

      chai.expect(contract.name).to.equal("Storage");
      chai.expect(contract.status).to.equal("error");
    };

    it("should not verify when session cookie not stored clientside", (done) => {
      chai
        .request(server.app)
        .post("/input-files")
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => {
          assertAfterMetadataUpload(err, res);

          chai
            .request(server.app)
            .post("/input-files")
            .attach("files", sourceBuffer, "1_Storage.sol")
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);

              chai.expect(res.body.unused).to.deep.equal(["1_Storage.sol"]);
              chai.expect(res.body.contracts).to.be.empty;
              done();
            });
        });
    });

    const assertAllFound = (err, res, finalStatus) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);
      chai.expect(res.body.unused).to.be.empty;

      const contracts = res.body.contracts;
      chai.expect(contracts).to.have.a.lengthOf(1);
      const contract = contracts[0];

      chai.expect(contract.name).to.equal("Storage");
      chai.expect(contract.status).to.equal(finalStatus);
      chai.expect(contract.storageTimestamp).to.not.exist;
    };

    it("should verify when session cookie stored clientside", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => {
          assertAfterMetadataUpload(err, res);
          const contracts = res.body.contracts;

          agent
            .post("/input-files")
            .attach("files", sourceBuffer, "1_Storage.sol")
            .end((err, res) => {
              contracts[0].chainId = contractChain;
              contracts[0].address = contractAddress;
              assertAllFound(err, res, "error");

              agent
                .post("/verify-validated")
                .send({ contracts })
                .end((err, res) => {
                  assertAllFound(err, res, "perfect");
                  done();
                });
            });
        });
    });

    it("should fail if too many files uploaded, but should succeed after deletion", (done) => {
      const agent = chai.request.agent(server.app);

      const file = "a".repeat((MAX_INPUT_SIZE * 3) / 4); // because of base64 encoding which increases size by 1/3, making it 4/3 of the original
      agent
        .post("/input-files")
        .attach("files", Buffer.from(file))
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.OK);

          agent
            .post("/input-files")
            .attach("files", Buffer.from("a"))
            .then((res) => {
              chai.expect(res.status).to.equal(StatusCodes.REQUEST_TOO_LONG);
              chai.expect(res.body.error).to.exist;

              agent.post("/restart-session").then((res) => {
                chai.expect(res.status).to.equal(StatusCodes.OK);

                agent
                  .post("/input-files")
                  .attach("files", Buffer.from("a"))
                  .then((res) => {
                    chai.expect(res.status).to.equal(StatusCodes.OK);
                    done();
                  });
              });
            });
        });
    });

    const assertSingleContractStatus = (
      res,
      expectedStatus,
      shouldHaveTimestamp
    ) => {
      chai.expect(res.status).to.equal(StatusCodes.OK);
      chai.expect(res.body).to.haveOwnProperty("contracts");
      const contracts = res.body.contracts;
      chai.expect(contracts).to.have.a.lengthOf(1);
      const contract = contracts[0];
      chai.expect(contract.status).to.equal(expectedStatus);
      chai.expect(!!contract.storageTimestamp).to.equal(!!shouldHaveTimestamp);
      return contracts;
    };

    it("should verify after providing address and then network; should provide timestamp when verifying again", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", sourceBuffer)
        .attach("files", metadataBuffer)
        .then((res) => {
          const contracts = assertSingleContractStatus(res, "error");
          contracts[0].address = contractAddress;

          agent
            .post("/verify-validated")
            .send({ contracts })
            .then((res) => {
              assertSingleContractStatus(res, "error");
              contracts[0].chainId = contractChain;

              agent
                .post("/verify-validated")
                .send({ contracts })
                .then((res) => {
                  assertSingleContractStatus(res, "perfect");

                  agent
                    .post("/verify-validated")
                    .send({ contracts })
                    .then((res) => {
                      assertSingleContractStatus(res, "perfect", true);
                      done();
                    });
                });
            });
        });
    });

    it("should fail for a source that is missing and unfetchable", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", modifiedMetadataBuffer)
        .then((res) => {
          assertAddressAndChainMissing(res, [], ["browser/1_Storage.sol"]);
          done();
        });
    });

    it("should fetch missing sources", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", metadataBuffer)
        .then((res) => {
          assertAddressAndChainMissing(res, ["browser/1_Storage.sol"], []);
          done();
        });
    });

    it("should verify after fetching and then providing address+chainId", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", metadataBuffer)
        .then((res) => {
          const contracts = assertAddressAndChainMissing(
            res,
            ["browser/1_Storage.sol"],
            []
          );
          contracts[0].address = contractAddress;
          contracts[0].chainId = contractChain;

          agent
            .post("/verify-validated")
            .send({ contracts })
            .then((res) => {
              assertSingleContractStatus(res, "perfect");
              done();
            });
        });
    });

    it("should correctly handle when uploaded 0/2 and then 1/2 sources", (done) => {
      const metadataPath = path.join(
        "test",
        "sources",
        "metadata",
        "child-contract.meta.object.json"
      );
      const metadataBuffer = fs.readFileSync(metadataPath);

      const parentPath = path.join(
        "test",
        "sources",
        "contracts",
        "ParentContract.sol"
      );
      const parentBuffer = fs.readFileSync(parentPath);

      const agent = chai.request.agent(server.app);
      agent
        .post("/input-files")
        .attach("files", metadataBuffer)
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body.contracts).to.have.lengthOf(1);
          chai.expect(res.body.unused).to.be.empty;

          const contract = res.body.contracts[0];
          chai.expect(contract.files.found).to.have.lengthOf(0);
          chai.expect(contract.files.missing).to.have.lengthOf(2);

          agent
            .post("/input-files")
            .attach("files", parentBuffer)
            .then((res) => {
              chai.expect(res.status).to.equal(StatusCodes.OK);
              chai.expect(res.body.contracts).to.have.lengthOf(1);
              chai.expect(res.body.unused).to.be.empty;

              const contract = res.body.contracts[0];
              chai.expect(contract.files.found).to.have.lengthOf(1);
              chai.expect(contract.files.missing).to.have.lengthOf(1);

              done();
            });
        });
    });

    it("should find contracts in a zipped Truffle project", (done) => {
      const zippedTrufflePath = path.join(
        "services",
        "validation",
        "test",
        "files",
        "truffle-example.zip"
      );
      const zippedTruffleBuffer = fs.readFileSync(zippedTrufflePath);
      chai
        .request(server.app)
        .post("/input-files")
        .attach("files", zippedTruffleBuffer)
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body.contracts).to.have.lengthOf(3);
          chai.expect(res.body.unused).to.be.empty;
          done();
        });
      it("should correctly handle when uploaded 0/2 and then 1/2 sources", (done) => {
        const metadataPath = path.join(
          "test",
          "sources",
          "metadata",
          "child-contract.meta.object.json"
        );
        const metadataBuffer = fs.readFileSync(metadataPath);

        const parentPath = path.join(
          "test",
          "sources",
          "contracts",
          "ParentContract.sol"
        );
        const parentBuffer = fs.readFileSync(parentPath);

        const agent = chai.request.agent(server.app);
        agent
          .post("/input-files")
          .attach("files", metadataBuffer)
          .then((res) => {
            chai.expect(res.status).to.equal(StatusCodes.OK);
            chai.expect(res.body.contracts).to.have.lengthOf(1);
            chai.expect(res.body.unused).to.be.empty;

            const contract = res.body.contracts[0];
            chai.expect(contract.files.found).to.have.lengthOf(0);
            chai.expect(contract.files.missing).to.have.lengthOf(2);

            agent
              .post("/input-files")
              .attach("files", parentBuffer)
              .then((res) => {
                chai.expect(res.status).to.equal(StatusCodes.OK);
                chai.expect(res.body.contracts).to.have.lengthOf(1);
                chai.expect(res.body.unused).to.be.empty;

                const contract = res.body.contracts[0];
                chai.expect(contract.files.found).to.have.lengthOf(1);
                chai.expect(contract.files.missing).to.have.lengthOf(1);

                done();
              });
          });
      });

      it("should find contracts in a zipped Truffle project", (done) => {
        const zippedTrufflePath = path.join(
          "services",
          "validation",
          "test",
          "files",
          "truffle-example.zip"
        );
        const zippedTruffleBuffer = fs.readFileSync(zippedTrufflePath);
        chai
          .request(server.app)
          .post("/input-files")
          .attach("files", zippedTruffleBuffer)
          .then((res) => {
            chai.expect(res.status).to.equal(StatusCodes.OK);
            chai.expect(res.body.contracts).to.have.lengthOf(3);
            chai.expect(res.body.unused).to.be.empty;
            done();
          });
      });
    });

    describe("hardhat build-info file support", function () {
      this.timeout(EXTENDED_TIME);

      const hardhatOutputPath = path.join(
        "test",
        "sources",
        "hardhat-output",
        "output.json"
      );

      const hardhatOutputBuffer = fs.readFileSync(hardhatOutputPath);

      it("should detect multiple contracts in the build-info file", (done) => {
        chai
          .request(server.app)
          .post("/")
          .field("chain", hardhatOutput.chain)
          .field("address", hardhatOutput.address)
          .attach("files", hardhatOutputBuffer)
          .then((res) => {
            chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
            chai.expect(res.body.contractsToChoose.length).to.be.equal(6);
            chai
              .expect(res.body.error)
              .to.be.a("string")
              .and.satisfy((msg) => msg.startsWith("Detected "));
            done();
          });
      });

      it("should verify the chosen contract in the build-info file", (done) => {
        chai
          .request(server.app)
          .post("/")
          .field("chain", hardhatOutput.chain)
          .field("address", hardhatOutput.address)
          .field("chosenContract", hardhatOutput.mainContractIndex)
          .attach("files", hardhatOutputBuffer)
          .end((err, res) => {
            assertions(err, res, done, hardhatOutput.address, "perfect");
          });
      });
    });
  });
});
