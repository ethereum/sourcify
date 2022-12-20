process.env.TESTING = true;
// This does not take effect when run with monitor tests. See config.ts note
process.env.MOCK_REPOSITORY = "./dist/data/mock-repository";
process.env.SOLC_REPO = "./dist/data/solc-repo";
process.env.SOLJSON_REPO = "/dist/data/soljson-repo";

const ganache = require("ganache");
const chai = require("chai");
const chaiHttp = require("chai-http");
const Server = require("../dist/server/server").Server;
const util = require("util");
const fs = require("fs");
const rimraf = require("rimraf");
const path = require("path");
const Web3 = require("web3");
const MAX_FILE_SIZE = require("../dist/config").default.server.maxFileSize;
const MAX_SESSION_SIZE =
  require("../dist/server/controllers/VerificationController").default
    .MAX_SESSION_SIZE;
const GANACHE_PORT = 8545;
const StatusCodes = require("http-status-codes").StatusCodes;
const { waitSecs, callContractMethodWithTx } = require("./helpers/helpers");
const { deployFromAbiAndBytecode } = require("./helpers/helpers");

chai.use(chaiHttp);

const binaryParser = function (res, cb) {
  res.setEncoding("binary");
  res.data = "";
  res.on("data", (chunk) => (res.data += chunk));
  res.on("end", () => cb(null, Buffer.from(res.data, "binary")));
};

const EXTENDED_TIME = 20000; // 20 seconds
const EXTENDED_TIME_60 = 60000; // 60 seconds

describe("Server", function () {
  const server = new Server();
  const ganacheServer = ganache.server({
    wallet: { totalAccounts: 1 },
    chain: { chainId: 0, networkId: 0 },
  });
  let localWeb3Provider;
  let accounts;
  let defaultContractAddress;
  const defaultContractChain = "0";
  let currentResponse = null; // to log server response when test fails

  const sourcePath = path.join(
    "test",
    "testcontracts",
    "Storage",
    "Storage.sol"
  );
  const sourceBuffer = fs.readFileSync(sourcePath);

  const artifact = require("./testcontracts/Storage/Storage.json");
  const metadata = require("./testcontracts/Storage/metadata.json");
  const metadataBuffer = Buffer.from(JSON.stringify(metadata));

  before(async () => {
    await ganacheServer.listen(GANACHE_PORT);
    console.log("Started ganache local server on port " + GANACHE_PORT);

    localWeb3Provider = new Web3(`http://localhost:${GANACHE_PORT}`);
    accounts = await localWeb3Provider.eth.getAccounts();
    console.log("Initialized web3 provider");

    // Deploy the test contract
    defaultContractAddress = await deployFromAbiAndBytecode(
      localWeb3Provider,
      artifact.abi,
      artifact.bytecode,
      accounts[0]
    );

    const promisified = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Injector listening on port ${server.port}!`);
  });

  beforeEach(() => {
    rimraf.sync(server.repository);
  });

  after(async () => {
    rimraf.sync(server.repository);
    await ganacheServer.close();
  });

  // log server response when test fails
  afterEach(function () {
    const errorBody = currentResponse && currentResponse.body;
    if (this.currentTest.state === "failed" && errorBody) {
      console.log(
        "Server response of failed test " + this.currentTest.title + ":"
      );
      console.log(errorBody);
    }
    currentResponse = null;
  });

  const ipfsAddress =
    metadata.sources["project:/contracts/Storage.sol"].urls[1];

  // change the last char in ipfs hash of the source file
  const lastChar = ipfsAddress.charAt(ipfsAddress.length - 1);
  const modifiedLastChar = lastChar === "a" ? "b" : "a";
  const modifiedIpfsAddress =
    ipfsAddress.slice(0, ipfsAddress.length - 1) + modifiedLastChar;
  const modifiedIpfsMetadata = { ...metadata };
  modifiedIpfsMetadata.sources["project:/contracts/Storage.sol"].urls[1] =
    modifiedIpfsAddress;
  const modifiedIpfsMetadataBuffer = Buffer.from(JSON.stringify(metadata));

  const fakeAddress = "0x000000bCB92160f8B7E094998Af6BCaD7fa537ff";

  const assertValidationError = (err, res, field) => {
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
    chai.expect(res.body.message.startsWith("Validation Error")).to.be.true;
    chai.expect(res.body.errors).to.be.an("array");
    chai.expect(res.body.errors).to.have.a.lengthOf(1);
    chai.expect(res.body.errors[0].field).to.equal(field);
  };

  const assertBytecodesDontMatch = (err, res, done) => {
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    chai.expect(res.body).to.haveOwnProperty("error");
    chai
      .expect(res.body.error)
      .to.include("The deployed and recompiled bytecode don't match.");
    if (done) done();
  };

  function assertEqualityFromPath(obj1, obj2path, options) {
    const obj2raw = fs.readFileSync(obj2path).toString();
    const obj2 = options?.isJson ? JSON.parse(obj2raw) : obj2raw;
    chai.expect(obj1, `assertFromPath: ${obj2path}`).to.deep.equal(obj2);
  }

  const assertions = (
    err,
    res,
    done,
    expectedAddress = defaultContractAddress,
    expectedStatus = "perfect"
  ) => {
    currentResponse = res;
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

  if (process.env.CIRCLE_PR_REPONAME === undefined) {
    describe("/session/verify/etherscan", function () {
      const assertAllFound = (err, res, finalStatus) => {
        chai.expect(err).to.be.null;
        chai.expect(res.status).to.equal(StatusCodes.OK);

        const contracts = res.body.contracts;
        chai.expect(contracts).to.have.a.lengthOf(1);
        const contract = contracts[0];

        chai.expect(contract.status).to.equal(finalStatus);
        chai.expect(contract.storageTimestamp).to.not.exist;
      };

      const assertEtherscanError = (err, res) => {
        chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
        chai.expect(res.body?.error).to.exist;
      };

      this.timeout(EXTENDED_TIME_60);

      it("should fail for missing address", (done) => {
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("chainId", "1")
          .end((err, res) => {
            assertValidationError(err, res, "address");
            done();
          });
      });

      it("should fail for missing chainId", (done) => {
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", fakeAddress)
          .end((err, res) => {
            assertValidationError(err, res, "chainId");
            done();
          });
      });

      it("should fail fetching a non verified contract from etherscan", (done) => {
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", fakeAddress)
          .field("chainId", "1")
          .end((err, res) => {
            assertEtherscanError(err, res);
            done();
          });
      });

      it("should fail by exceeding rate limit on etherscan APIs", (done) => {
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", fakeAddress)
          .field("chainId", "1")
          .end(() => {
            chai
              .request(server.app)
              .post("/session/verify/etherscan")
              .field("address", fakeAddress)
              .field("chainId", "1")
              .end((err, res) => {
                assertEtherscanError(err, res);
                done();
              });
          });
      });

      it("should import contract information from etherscan (single file) and verify the contract, finding a partial match", (done) => {
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", "0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4")
          .field("chainId", "5")
          .end((err, res) => {
            assertAllFound(err, res, "partial");
            done();
          });
      });

      it("should import contract information from etherscan (multiple files) and verify the contract, finding a partial match", (done) => {
        chai
          .request(server.app)
          .post("/session/verify/etherscan")
          .field("address", "0x5aa653a076c1dbb47cec8c1b4d152444cad91941")
          .field("chainId", "1")
          .end((err, res) => {
            assertAllFound(err, res, "partial");
            done();
          });
      });
    });
  }

  describe("/session/verify/create2", function () {
    const assertAllFound = (err, res, finalStatus) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);

      const contracts = res.body.contracts;
      chai.expect(contracts).to.have.a.lengthOf(1);
      const contract = contracts[0];

      chai.expect(contract.status).to.equal(finalStatus);
    };

    const assertAPIAllFound = (err, res, finalStatus) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);

      const contracts = res.body.result;
      chai.expect(contracts).to.have.a.lengthOf(1);
      const contract = contracts[0];

      chai.expect(contract.status).to.equal(finalStatus);
    };

    this.timeout(EXTENDED_TIME_60);

    const agent = chai.request.agent(server.app);
    let verificationId;

    it("should input files from existing contract via auxdata ipfs", async () => {
      const artifacts = require("./testcontracts/Create2/Wallet.json");

      const addressDeployed = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifacts.abi,
        artifacts.bytecode,
        accounts[0],
        [accounts[0], accounts[0]]
      );

      process.env.IPFS_GATEWAY = "https://ipfs.io/ipfs/";
      const res = await agent
        .post("/session/input-contract")
        .field("address", addressDeployed)
        .field("chainId", defaultContractChain);

      verificationId = res.body.contracts[0].verificationId;
      chai.expect(res.body.contracts).to.have.a.lengthOf(1);
      const contract = res.body.contracts[0];
      chai.expect(contract.files.found).to.have.a.lengthOf(1);
      const retrivedFile = contract.files.found[0];
      chai.expect(retrivedFile).to.equal("contracts/create2/Wallet.sol");
    });

    it("should create2 verify", (done) => {
      let clientToken;
      const sourcifyClientTokensRaw = process.env.CREATE2_CLIENT_TOKENS;
      if (sourcifyClientTokensRaw?.length) {
        const sourcifyClientTokens = sourcifyClientTokensRaw.split(",");
        clientToken = sourcifyClientTokens[0];
      }
      agent
        .post("/session/verify/create2")
        .send({
          deployerAddress: "0xd9145CCE52D386f254917e481eB44e9943F39138",
          salt: 12345,
          abiEncodedConstructorArguments:
            "0x0000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc4",
          clientToken: clientToken || "",
          create2Address: "0x801B9c0Ee599C3E5ED60e4Ec285C95fC9878Ee64",
          verificationId: verificationId,
        })
        .end((err, res) => {
          assertAllFound(err, res, "perfect");
          done();
        });
    });

    it("should create2 verify through API", (done) => {
      const metadata = fs
        .readFileSync("test/testcontracts/Create2/Wallet_metadata.json")
        .toString();
      const source = fs
        .readFileSync("test/testcontracts/Create2/Wallet.sol")
        .toString();
      let clientToken;
      const sourcifyClientTokensRaw = process.env.CREATE2_CLIENT_TOKENS;
      if (sourcifyClientTokensRaw?.length) {
        const sourcifyClientTokens = sourcifyClientTokensRaw.split(",");
        clientToken = sourcifyClientTokens[0];
      }
      chai
        .request(server.app)
        .post("/verify/create2")
        .send({
          deployerAddress: "0xd9145CCE52D386f254917e481eB44e9943F39138",
          salt: 12345,
          abiEncodedConstructorArguments:
            "0x0000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc4",
          files: {
            "metadata.json": metadata,
            "Wallet.sol": source,
          },
          clientToken: clientToken || "",
          create2Address: "0x801B9c0Ee599C3E5ED60e4Ec285C95fC9878Ee64",
        })
        .end((err, res) => {
          assertAPIAllFound(err, res, "perfect");
          done();
        });
    });
  });

  describe("/check-by-addresses", function () {
    this.timeout(EXTENDED_TIME);

    it("should fail for missing chainIds", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ addresses: defaultContractAddress })
        .end((err, res) => {
          assertValidationError(err, res, "chainIds");
          done();
        });
    });

    it("should fail for missing addresses", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ chainIds: 1 })
        .end((err, res) => {
          assertValidationError(err, res, "addresses");
          done();
        });
    });

    const assertStatus = (err, res, expectedStatus, expectedChainIds, done) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);
      const resultArray = res.body;
      chai.expect(resultArray).to.have.a.lengthOf(1);
      const result = resultArray[0];
      chai.expect(result.address).to.equal(defaultContractAddress);
      chai.expect(result.status).to.equal(expectedStatus);
      chai.expect(result.chainIds).to.deep.equal(expectedChainIds);
      if (done) done();
    };

    it("should return false for previously unverified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({
          chainIds: defaultContractChain,
          addresses: defaultContractAddress,
        })
        .end((err, res) => assertStatus(err, res, "false", undefined, done));
    });

    it("should fail for invalid address", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({ chainIds: defaultContractChain, addresses: fakeAddress })
        .end((err, res) => {
          assertValidationError(err, res, "addresses");
          done();
        });
    });

    it("should return true for previously verified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({
          chainIds: defaultContractChain,
          addresses: defaultContractAddress,
        })
        .end((err, res) => {
          assertStatus(err, res, "false", undefined);
          chai
            .request(server.app)
            .post("/")
            .field("address", defaultContractAddress)
            .field("chain", defaultContractChain)
            .attach("files", metadataBuffer, "metadata.json")
            .attach("files", sourceBuffer)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);

              chai
                .request(server.app)
                .get("/check-by-addresses")
                .query({
                  chainIds: defaultContractChain,
                  addresses: defaultContractAddress,
                })
                .end((err, res) =>
                  assertStatus(
                    err,
                    res,
                    "perfect",
                    [defaultContractChain],
                    done
                  )
                );
            });
        });
    });

    it("should convert addresses to checksummed format", (done) => {
      chai
        .request(server.app)
        .get("/check-by-addresses")
        .query({
          chainIds: defaultContractChain,
          addresses: defaultContractAddress.toLowerCase(),
        })
        .end((err, res) => {
          chai.expect(err).to.be.null;
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body).to.have.a.lengthOf(1);
          const result = res.body[0];
          chai.expect(result.address).to.equal(defaultContractAddress);
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
        .query({ addresses: defaultContractAddress })
        .end((err, res) => {
          assertValidationError(err, res, "chainIds");
          done();
        });
    });

    it("should fail for missing addresses", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ chainIds: 1 })
        .end((err, res) => {
          assertValidationError(err, res, "addresses");
          done();
        });
    });

    const assertStatus = (err, res, expectedStatus, expectedChainIds, done) => {
      chai.expect(err).to.be.null;
      chai.expect(res.status).to.equal(StatusCodes.OK);
      const resultArray = res.body;
      chai.expect(resultArray).to.have.a.lengthOf(1);
      const result = resultArray[0];
      chai.expect(result.address).to.equal(defaultContractAddress);
      chai.expect(result.status).to.equal(expectedStatus);
      chai.expect(result.chainIds).to.deep.equal(expectedChainIds);
      if (done) done();
    };

    it("should return false for previously unverified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({
          chainIds: defaultContractChain,
          addresses: defaultContractAddress,
        })
        .end((err, res) => assertStatus(err, res, "false", undefined, done));
    });

    it("should fail for invalid address", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({ chainIds: defaultContractChain, addresses: fakeAddress })
        .end((err, res) => {
          assertValidationError(err, res, "addresses");
          done();
        });
    });

    it("should return true for previously verified contract", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({
          chainIds: defaultContractChain,
          addresses: defaultContractAddress,
        })
        .end((err, res) => {
          assertStatus(err, res, "false", undefined);
          chai
            .request(server.app)
            .post("/")
            .field("address", defaultContractAddress)
            .field("chain", defaultContractChain)
            .attach("files", metadataBuffer, "metadata.json")
            .attach("files", sourceBuffer)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);

              chai
                .request(server.app)
                .get("/check-all-by-addresses")
                .query({
                  chainIds: defaultContractChain,
                  addresses: defaultContractAddress,
                })
                .end((err, res) =>
                  assertStatus(
                    err,
                    res,
                    undefined,
                    [{ chainId: defaultContractChain, status: "perfect" }],
                    done
                  )
                );
            });
        });
    });

    it("should convert addresses to checksummed format", (done) => {
      chai
        .request(server.app)
        .get("/check-all-by-addresses")
        .query({
          chainIds: defaultContractChain,
          addresses: defaultContractAddress.toLowerCase(),
        })
        .end((err, res) => {
          chai.expect(err).to.be.null;
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body).to.have.a.lengthOf(1);
          const result = res.body[0];
          chai.expect(result.address).to.equal(defaultContractAddress);
          chai.expect(result.status).to.equal("false");
          done();
        });
    });
  });

  const checkNonVerified = (path, done) => {
    chai
      .request(server.app)
      .post(path)
      .field("chain", defaultContractChain)
      .field("address", defaultContractAddress)
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
        .field("address", defaultContractAddress)
        .field("chain", defaultContractChain)
        .attach("files", metadataBuffer, "metadata.json")
        .attach("files", sourceBuffer, "Storage.sol")
        .end((err, res) => assertions(err, res, done));
    });

    it("should verify json upload with string properties", (done) => {
      chai
        .request(server.app)
        .post("/")
        .send({
          address: defaultContractAddress,
          chain: defaultContractChain,
          files: {
            "metadata.json": metadataBuffer.toString(),
            "Storage.sol": sourceBuffer.toString(),
          },
        })
        .end((err, res) => assertions(err, res, done));
    });

    it("should verify json upload with Buffer properties", (done) => {
      chai
        .request(server.app)
        .post("/")
        .send({
          address: defaultContractAddress,
          chain: defaultContractChain,
          files: {
            "metadata.json": metadataBuffer,
            "Storage.sol": sourceBuffer,
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
        .field("address", defaultContractAddress)
        .field("chain", defaultContractChain)
        .attach("files", modifiedIpfsMetadataBuffer, "metadata.json")
        .end((err, res) => {
          assertMissingFile(err, res);
          done();
        });
    });

    it("should fetch a missing file that is accessible via ipfs", (done) => {
      chai
        .request(server.app)
        .post("/")
        .field("address", defaultContractAddress)
        .field("chain", defaultContractChain)
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => assertions(err, res, done));
    });

    it("should return 'partial', then delete partial when 'full' match", (done) => {
      const partialMetadata = require("./testcontracts/Storage/metadataModified.json");
      const partialMetadataBuffer = Buffer.from(
        JSON.stringify(partialMetadata)
      );

      const partialSourcePath = path.join(
        "test",
        "testcontracts",
        "Storage",
        "StorageModified.sol"
      );
      const partialSourceBuffer = fs.readFileSync(partialSourcePath);

      const partialMetadataURL = `/repository/contracts/partial_match/${defaultContractChain}/${defaultContractAddress}/metadata.json`;

      chai
        .request(server.app)
        .post("/")
        .field("address", defaultContractAddress)
        .field("chain", defaultContractChain)
        .attach("files", partialMetadataBuffer, "metadata.json")
        .attach("files", partialSourceBuffer)
        .end((err, res) => {
          assertions(err, res, null, defaultContractAddress, "partial");

          chai
            .request(server.app)
            .get(partialMetadataURL)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.body).to.deep.equal(partialMetadata);

              chai
                .request(server.app)
                .post("/")
                .field("address", defaultContractAddress)
                .field("chain", defaultContractChain)
                .attach("files", metadataBuffer, "metadata.json")
                .attach("files", sourceBuffer)
                .end(async (err, res) => {
                  assertions(err, res, null, defaultContractAddress);

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

    it("should mark contracts without an embedded metadata hash as a 'partial' match", async () => {
      // Simple contract without bytecode at https://goerli.etherscan.io/address/0x093203902B71Cdb1dAA83153b3Df284CD1a2f88d
      const bytecode =
        "0x6080604052348015600f57600080fd5b50601680601d6000396000f3fe6080604052600080fdfea164736f6c6343000700000a";
      const metadataPath = path.join(
        "test",
        "sources",
        "metadata",
        "withoutMetadataHash.meta.object.json"
      );
      const metadataBuffer = fs.readFileSync(metadataPath);
      const metadata = JSON.parse(metadataBuffer.toString());
      const address = await deployFromAbiAndBytecode(
        localWeb3Provider,
        metadata.output.abi,
        bytecode,
        accounts[0]
      );

      const res = await chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", defaultContractChain)
        .attach("files", metadataBuffer)
        .send();

      assertions(null, res, null, address, "partial");
    });

    it("should verify a contract with library placeholders", async () => {
      // Originally https://goerli.etherscan.io/address/0x399B23c75d8fd0b95E81E41e1c7c88937Ee18000#code
      const artifact = require("./sources/artifacts/UsingLibrary.json");
      const address = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );
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

      const res = await chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", defaultContractChain)
        .attach("files", metadataBuffer)
        .attach("files", sourceBuffer)
        .send();

      assertions(null, res, null, address, "perfect");

      const res2 = await chai
        .request(server.app)
        .get(
          `/repository/contracts/full_match/${defaultContractChain}/${address}/library-map.json`
        )
        .buffer()
        .parse(binaryParser)
        .send();

      chai.expect(res2.status).to.equal(StatusCodes.OK);
      const receivedLibraryMap = JSON.parse(res2.body.toString());
      const expectedLibraryMap = {
        __$da572ae5e60c838574a0f88b27a0543803$__:
          "11fea6722e00ba9f43861a6e4da05fecdf9806b7",
      };
      chai.expect(receivedLibraryMap).to.deep.equal(expectedLibraryMap);
    });

    it("should verify a contract with viaIR:true", async () => {
      const artifact = require("./testcontracts/Storage/Storage-viaIR.json");
      const address = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );
      // metadata is in artifact JSON
      const metadataBuffer = Buffer.from(artifact.metadata);

      const sourcePath = path.join(
        "test",
        "testcontracts",
        "Storage",
        "Storage.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const res = await chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", defaultContractChain)
        .attach("files", metadataBuffer, "metadata.json")
        .attach("files", sourceBuffer, "Storage.sol")
        .send();
      assertions(null, res, null, address);
    });

    // https://github.com/ethereum/sourcify/issues/640
    it("should remove the inliner option from metadata for solc >=0.8.2 to <=0.8.4", async () => {
      const artifact = require("./testcontracts/Storage/Storage.json");
      const address = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );
      const metadataPath = path.join(
        "test",
        "testcontracts",
        "Storage",
        "metadata-inliner.json"
      );
      const metadataBuffer = fs.readFileSync(metadataPath);

      const sourcePath = path.join(
        "test",
        "testcontracts",
        "Storage",
        "Storage.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const res = await chai
        .request(server.app)
        .post("/")
        .field("address", address)
        .field("chain", defaultContractChain)
        .attach("files", metadataBuffer, "metadata-inliner.json")
        .attach("files", sourceBuffer, "Storage.sol")
        .send();
      assertions(null, res, null, address);
    });

    it("should verify a contract created by a factory contract and has immutables", async () => {
      const deployValue = 12345;

      const artifact = require("./testcontracts/FactoryImmutable/Factory.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling deploy(uint)
      const childMetadata = require("./testcontracts/FactoryImmutable/Child_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "deploy",
        accounts[0],
        [deployValue]
      );

      const childAddress = txReceipt.events.Deployment.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutable",
        "FactoryTest.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const abiEncoded = localWeb3Provider.eth.abi.encodeParameter(
        "uint",
        deployValue
      );
      const res = await chai
        .request(server.app)
        .post("/")
        .send({
          address: childAddress,
          chain: defaultContractChain,
          contextVariables: {
            abiEncodedConstructorArguments: abiEncoded,
          },
          files: {
            "metadata.json": JSON.stringify(childMetadata),
            "FactoryTest.sol": sourceBuffer.toString(),
          },
        });
      assertions(null, res, null, childAddress);
    });

    it("should verify a contract created by a factory contract and has immutables without constructor arguments but with msg.sender assigned immutable", async () => {
      const artifact = require("./testcontracts/FactoryImmutableWithoutConstrArg/Factory3.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling createChild()
      const childMetadata = require("./testcontracts/FactoryImmutableWithoutConstrArg/Child3_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "createChild",
        accounts[0],
        []
      );

      const childAddress = txReceipt.events.ChildCreated.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutableWithoutConstrArg",
        "FactoryTest3.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const res = await chai
        .request(server.app)
        .post("/")
        .send({
          address: childAddress,
          chain: defaultContractChain,
          contextVariables: {
            msgSender: factoryAddress,
          },
          files: {
            "metadata.json": JSON.stringify(childMetadata),
            "FactoryTest3.sol": sourceBuffer.toString(),
          },
        });
      assertions(null, res, null, childAddress);
    });

    it("should first fail to verify a contract created by a factory contract and has an immutable set by `msg.sender`. Then suceed with the `msg.sender` input and save the contextVariables", async () => {
      const deployValue = 12345;

      const artifact = require("./testcontracts/FactoryImmutableWithMsgSender/Factory.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling createChild()
      const childMetadata = require("./testcontracts/FactoryImmutableWithMsgSender/Child_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "deploy",
        accounts[0],
        [deployValue]
      );

      const childAddress = txReceipt.events.Deployment.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutableWithMsgSender",
        "FactoryTest.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const abiEncoded = localWeb3Provider.eth.abi.encodeParameter(
        "uint",
        deployValue
      );
      const res1 = await chai
        .request(server.app)
        .post("/")
        .send({
          address: childAddress,
          chain: defaultContractChain,
          contextVariables: {
            abiEncodedConstructorArguments: abiEncoded,
          },
          files: {
            "metadata.json": JSON.stringify(childMetadata),
            "FactoryTest.sol": sourceBuffer.toString(),
          },
        });
      assertBytecodesDontMatch(null, res1);

      const res2 = await chai
        .request(server.app)
        .post("/")
        .send({
          address: childAddress,
          chain: defaultContractChain,
          contextVariables: {
            abiEncodedConstructorArguments: abiEncoded,
            msgSender: factoryAddress,
          },
          files: {
            "metadata.json": JSON.stringify(childMetadata),
            "FactoryTest.sol": sourceBuffer.toString(),
          },
        });
      assertions(null, res2, null, childAddress);

      // Check if contextVariables.json saved correctly
      assertEqualityFromPath(
        {
          msgSender: factoryAddress,
          abiEncodedConstructorArguments: abiEncoded,
        },
        path.join(
          server.repository,
          "contracts",
          "full_match",
          defaultContractChain,
          childAddress,
          "contextVariables.json"
        ),
        { isJson: true }
      );
    });

    it("should first fail to verify a contract created by a factory contract using form-data in request and not JSON", async () => {
      const deployValue = 12345;

      const artifact = require("./testcontracts/FactoryImmutableWithMsgSender/Factory.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling createChild()
      const childMetadata = require("./testcontracts/FactoryImmutableWithMsgSender/Child_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "deploy",
        accounts[0],
        [deployValue]
      );

      const childAddress = txReceipt.events.Deployment.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutableWithMsgSender",
        "FactoryTest.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const abiEncoded = localWeb3Provider.eth.abi.encodeParameter(
        "uint",
        deployValue
      );

      const res2 = await chai
        .request(server.app)
        .post("/")
        .field("address", childAddress)
        .field("chain", defaultContractChain)
        .field("abiEncodedConstructorArguments", abiEncoded)
        .field("msgSender", factoryAddress)
        .attach("files", childMetadataBuffer, "metadata.json")
        .attach("files", sourceBuffer, "FactoryTest.sol");
      assertions(null, res2, null, childAddress);

      // Check if contextVariables.json saved correctly
      assertEqualityFromPath(
        {
          msgSender: factoryAddress,
          abiEncodedConstructorArguments: abiEncoded,
        },
        path.join(
          server.repository,
          "contracts",
          "full_match",
          defaultContractChain,
          childAddress,
          "contextVariables.json"
        ),
        { isJson: true }
      );
    });

    describe("hardhat build-info file support", function () {
      this.timeout(EXTENDED_TIME);
      let address;
      const mainContractIndex = 5;
      const hardhatOutputJSON = require("./sources/hardhat-output/output.json");
      const MyToken =
        hardhatOutputJSON.output.contracts["contracts/MyToken.sol"].MyToken;
      const hardhatOutputBuffer = Buffer.from(
        JSON.stringify(hardhatOutputJSON)
      );
      before(async function () {
        address = await deployFromAbiAndBytecode(
          localWeb3Provider,
          MyToken.abi,
          MyToken.evm.bytecode.object,
          accounts[0],
          ["Sourcify Hardhat Test", "TEST"]
        );
        console.log(`Contract deployed at ${address}`);
        await waitSecs(3);
      });

      it("should detect multiple contracts in the build-info file", (done) => {
        chai
          .request(server.app)
          .post("/")
          .field("chain", defaultContractChain)
          .field("address", address)
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
          .field("chain", defaultContractChain)
          .field("address", address)
          .field("chosenContract", mainContractIndex)
          .attach("files", hardhatOutputBuffer)
          .end((err, res) => {
            assertions(err, res, done, address, "perfect");
          });
      });
    });

    describe("solc v0.6.12 and v0.7.0 extra files in compilation causing metadata match but bytecode mismatch", function () {
      // Deploy the test contract locally
      // Contract from https://explorer.celo.org/address/0x923182024d0Fa5dEe59E3c3db5e2eeD23728D3C3/contracts
      let contractAddress;
      const bytecodeMismatchArtifact = require("./sources/artifacts/extraFilesBytecodeMismatch.json");

      before(async () => {
        contractAddress = await deployFromAbiAndBytecode(
          localWeb3Provider,
          bytecodeMismatchArtifact.abi,
          bytecodeMismatchArtifact.bytecode,
          accounts[0]
        );
      });

      it("should warn the user about the issue when metadata match but not bytecodes", (done) => {
        const hardhatOutput = require("./sources/hardhat-output/extraFilesBytecodeMismatch-onlyMetadata.json");
        const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutput));
        chai
          .request(server.app)
          .post("/")
          .field("chain", defaultContractChain)
          .field("address", contractAddress)
          .attach("files", hardhatOutputBuffer)
          .end((err, res) => {
            assertions(err, res, done, contractAddress, "extra-file-input-bug");
          });
      });

      it("should verify with all input files and not only those in metadata", (done) => {
        const hardhatOutput = require("./sources/hardhat-output/extraFilesBytecodeMismatch.json");
        const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutput));
        chai
          .request(server.app)
          .post("/")
          .field("chain", defaultContractChain)
          .field("address", contractAddress)
          .attach("files", hardhatOutputBuffer)
          .end((err, res) => {
            assertions(err, res, done, contractAddress, "perfect");
          });
      });
    });
  });

  describe("session api verification", function () {
    this.timeout(EXTENDED_TIME);

    it("should inform when no pending contracts", (done) => {
      chai
        .request(server.app)
        .post("/session/verify-validated")
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
        .post("/session/input-files")
        .send({
          files: {
            "metadata.json": metadataBuffer.toString(),
            "Storage.sol": sourceBuffer.toString(),
          },
        })
        .then((res) => {
          assertAddressAndChainMissing(
            res,
            ["project:/contracts/Storage.sol"],
            {}
          );
          done();
        });
    });

    it("should not verify after addition of metadata+source, but should after providing address+chainId", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/session/input-files")
        .attach("files", sourceBuffer, "Storage.sol")
        .attach("files", metadataBuffer, "metadata.json")
        .then((res) => {
          const contracts = assertAddressAndChainMissing(
            res,
            ["project:/contracts/Storage.sol"],
            {}
          );
          contracts[0].address = defaultContractAddress;
          contracts[0].chainId = defaultContractChain;

          agent
            .post("/session/verify-validated")
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
        .post("/session/input-files")
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => {
          assertAfterMetadataUpload(err, res);

          chai
            .request(server.app)
            .post("/session/input-files")
            .attach("files", sourceBuffer, "Storage.sol")
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);

              chai.expect(res.body.unused).to.deep.equal(["Storage.sol"]);
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
        .post("/session/input-files")
        .attach("files", metadataBuffer, "metadata.json")
        .end((err, res) => {
          assertAfterMetadataUpload(err, res);
          const contracts = res.body.contracts;

          agent
            .post("/session/input-files")
            .attach("files", sourceBuffer, "Storage.sol")
            .end((err, res) => {
              contracts[0].chainId = defaultContractChain;
              contracts[0].address = defaultContractAddress;
              assertAllFound(err, res, "error");

              agent
                .post("/session/verify-validated")
                .send({ contracts })
                .end((err, res) => {
                  assertAllFound(err, res, "perfect");
                  done();
                });
            });
        });
    });

    it("should fail with HTTP 413 if a file above max server file size is uploaded", (done) => {
      const agent = chai.request.agent(server.app);
      const file = "a".repeat(MAX_FILE_SIZE + 1);
      agent
        .post("/session/input-files")
        .attach("files", Buffer.from(file))
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.REQUEST_TOO_LONG);
          done();
        });
    });

    it("should fail if too many files uploaded, but should succeed after deletion", async () => {
      const agent = chai.request.agent(server.app);
      let res;
      const maxNumMaxFiles = Math.floor(MAX_SESSION_SIZE / MAX_FILE_SIZE); // Max number of max size files allowed in a session
      const file = "a".repeat((MAX_FILE_SIZE * 3) / 4); // because of base64 encoding which increases size by 1/3, making it 4/3 of the original
      for (let i = 0; i < maxNumMaxFiles; i++) {
        // Should be allowed each time
        res = await agent
          .post("/session/input-files")
          .attach("files", Buffer.from(file));
        chai.expect(res.status).to.equal(StatusCodes.OK);
      }
      // Should exceed size this time
      res = await agent
        .post("/session/input-files")
        .attach("files", Buffer.from(file));
      chai.expect(res.status).to.equal(StatusCodes.REQUEST_TOO_LONG);
      chai.expect(res.body.error).to.exist;
      // Should be back to normal
      res = await agent.post("/session/clear");
      chai.expect(res.status).to.equal(StatusCodes.OK);
      res = await agent
        .post("/session/input-files")
        .attach("files", Buffer.from("a"));
      chai.expect(res.status).to.equal(StatusCodes.OK);
      console.log("done");
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
        .post("/session/input-files")
        .attach("files", sourceBuffer)
        .attach("files", metadataBuffer)
        .then((res) => {
          const contracts = assertSingleContractStatus(res, "error");
          contracts[0].address = defaultContractAddress;

          agent
            .post("/session/verify-validated")
            .send({ contracts })
            .then((res) => {
              assertSingleContractStatus(res, "error");
              contracts[0].chainId = defaultContractChain;

              agent
                .post("/session/verify-validated")
                .send({ contracts })
                .then((res) => {
                  assertSingleContractStatus(res, "perfect");

                  agent
                    .post("/session/verify-validated")
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
        .post("/session/input-files")
        .attach("files", modifiedIpfsMetadataBuffer)
        .then((res) => {
          assertAddressAndChainMissing(res, [], {
            "project:/contracts/Storage.sol": {
              keccak256:
                "0x88c47206b5ec3d60ab820e9d126c4ac54cb17fa7396ff49ebe27db2862982ad8",
              urls: [
                "bzz-raw://5d1eeb01c8c10bed9e290f4a80a8d4081422a7b298a13049d72867022522cf6b",
                "dweb:/ipfs/QmaFRC9ZtT7y3t9XNWCbDuMTEwKkyaQJzYFzw3NbeohSna", // last char changed to "a"
              ],
            },
          });
          done();
        });
    });

    it("should fetch missing sources", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/session/input-files")
        .attach("files", metadataBuffer)
        .then((res) => {
          assertAddressAndChainMissing(
            res,
            ["project:/contracts/Storage.sol"],
            {}
          );
          done();
        });
    });

    it("should verify after fetching and then providing address+chainId", (done) => {
      const agent = chai.request.agent(server.app);
      agent
        .post("/session/input-files")
        .attach("files", metadataBuffer)
        .then((res) => {
          const contracts = assertAddressAndChainMissing(
            res,
            ["project:/contracts/Storage.sol"],
            {}
          );
          contracts[0].address = defaultContractAddress;
          contracts[0].chainId = defaultContractChain;

          agent
            .post("/session/verify-validated")
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
        .post("/session/input-files")
        .attach("files", metadataBuffer)
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body.contracts).to.have.lengthOf(1);
          chai.expect(res.body.unused).to.be.empty;

          const contract = res.body.contracts[0];
          chai.expect(contract.files.found).to.have.lengthOf(0);
          chai.expect(Object.keys(contract.files.missing)).to.have.lengthOf(2);

          agent
            .post("/session/input-files")
            .attach("files", parentBuffer)
            .then((res) => {
              chai.expect(res.status).to.equal(StatusCodes.OK);
              chai.expect(res.body.contracts).to.have.lengthOf(1);
              chai.expect(res.body.unused).to.be.empty;

              const contract = res.body.contracts[0];
              chai.expect(contract.files.found).to.have.lengthOf(1);
              chai
                .expect(Object.keys(contract.files.missing))
                .to.have.lengthOf(1);

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
        .post("/session/input-files")
        .attach("files", zippedTruffleBuffer)
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.OK);
          chai.expect(res.body.contracts).to.have.lengthOf(3);
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
          .post("/session/input-files")
          .attach("files", metadataBuffer)
          .then((res) => {
            chai.expect(res.status).to.equal(StatusCodes.OK);
            chai.expect(res.body.contracts).to.have.lengthOf(1);
            chai.expect(res.body.unused).to.be.empty;

            const contract = res.body.contracts[0];
            chai.expect(contract.files.found).to.have.lengthOf(0);
            chai.expect(contract.files.missing).to.have.lengthOf(2);

            agent
              .post("/session/input-files")
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
          .post("/session/input-files")
          .attach("files", zippedTruffleBuffer)
          .then((res) => {
            chai.expect(res.status).to.equal(StatusCodes.OK);
            chai.expect(res.body.contracts).to.have.lengthOf(3);
            chai.expect(res.body.unused).to.be.empty;
            done();
          });
      });
    });

    it("should verify a contract created by a factory contract and has immutables", async () => {
      const deployValue = 12345;

      const artifact = require("./testcontracts/FactoryImmutable/Factory.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling deploy(uint)
      const childMetadata = require("./testcontracts/FactoryImmutable/Child_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "deploy",
        accounts[0],
        [deployValue]
      );

      const childAddress = txReceipt.events.Deployment.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutable",
        "FactoryTest.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const abiEncoded = localWeb3Provider.eth.abi.encodeParameter(
        "uint",
        deployValue
      );
      const agent = chai.request.agent(server.app);

      const res1 = await agent
        .post("/session/input-files")
        .attach("files", sourceBuffer)
        .attach("files", childMetadataBuffer);

      const contracts = assertSingleContractStatus(res1, "error");

      contracts[0].address = childAddress;
      contracts[0].chainId = defaultContractChain;
      contracts[0].contextVariables = {
        abiEncodedConstructorArguments: abiEncoded,
      };
      const res = await agent
        .post("/session/verify-validated")
        .send({ contracts });
      assertSingleContractStatus(res, "perfect");
    });

    it("should verify a contract created by a factory contract and has immutables without constructor arguments but with msg.sender assigned immutable", async () => {
      const artifact = require("./testcontracts/FactoryImmutableWithoutConstrArg/Factory3.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling deploy(uint)
      const childMetadata = require("./testcontracts/FactoryImmutableWithoutConstrArg/Child3_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "createChild",
        accounts[0],
        []
      );

      const childAddress = txReceipt.events.ChildCreated.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutableWithoutConstrArg",
        "FactoryTest3.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const agent = chai.request.agent(server.app);

      const res1 = await agent
        .post("/session/input-files")
        .attach("files", sourceBuffer)
        .attach("files", childMetadataBuffer);

      const contracts = assertSingleContractStatus(res1, "error");

      contracts[0].address = childAddress;
      contracts[0].chainId = defaultContractChain;
      contracts[0].contextVariables = { msgSender: factoryAddress };
      const res = await agent
        .post("/session/verify-validated")
        .send({ contracts });
      assertSingleContractStatus(res, "perfect");
    });

    it("should first fail to verify a contract created by a factory contract and has an immutable set by `msg.sender`. Then succeed with the `msg.sender` input and save the contextVariables", async () => {
      const deployValue = 12345;

      const artifact = require("./testcontracts/FactoryImmutableWithMsgSender/Factory.json");
      const factoryAddress = await deployFromAbiAndBytecode(
        localWeb3Provider,
        artifact.abi,
        artifact.bytecode,
        accounts[0]
      );

      // Deploy child by calling deploy(uint)
      const childMetadata = require("./testcontracts/FactoryImmutableWithMsgSender/Child_metadata.json");
      const childMetadataBuffer = Buffer.from(JSON.stringify(childMetadata));
      const txReceipt = await callContractMethodWithTx(
        localWeb3Provider,
        artifact.abi,
        factoryAddress,
        "deploy",
        accounts[0],
        [deployValue]
      );

      const childAddress = txReceipt.events.Deployment.returnValues[0];
      const sourcePath = path.join(
        "test",
        "testcontracts",
        "FactoryImmutableWithMsgSender",
        "FactoryTest.sol"
      );
      const sourceBuffer = fs.readFileSync(sourcePath);

      const abiEncoded = localWeb3Provider.eth.abi.encodeParameter(
        "uint",
        deployValue
      );
      const agent = chai.request.agent(server.app);

      const res1 = await agent
        .post("/session/input-files")
        .attach("files", sourceBuffer)
        .attach("files", childMetadataBuffer);

      const contracts = assertSingleContractStatus(res1, "error");

      contracts[0].address = childAddress;
      contracts[0].chainId = defaultContractChain;
      contracts[0].contextVariables = {
        abiEncodedConstructorArguments: abiEncoded,
      };
      const res2 = await agent
        .post("/session/verify-validated")
        .send({ contracts });
      assertSingleContractStatus(res2, "error");

      contracts[0].contextVariables = {
        msgSender: factoryAddress,
        ...contracts[0].contextVariables,
      };
      const res3 = await agent
        .post("/session/verify-validated")
        .send({ contracts });
      assertSingleContractStatus(res3, "perfect");

      // Check if contextVariables.json saved correctly
      assertEqualityFromPath(
        {
          msgSender: factoryAddress,
          abiEncodedConstructorArguments: abiEncoded,
        },
        path.join(
          server.repository,
          "contracts",
          "full_match",
          defaultContractChain,
          childAddress,
          "contextVariables.json"
        ),
        { isJson: true }
      );
    });

    // Test also extra-file-bytecode-mismatch via v2 API as well since the workaround is at the API level i.e. VerificationController
    describe("solc v0.6.12 and v0.7.0 extra files in compilation causing metadata match but bytecode mismatch", function () {
      // Deploy the test contract locally
      // Contract from https://explorer.celo.org/address/0x923182024d0Fa5dEe59E3c3db5e2eeD23728D3C3/contracts
      let contractAddress;
      const bytecodeMismatchArtifact = require("./sources/artifacts/extraFilesBytecodeMismatch.json");

      before(async () => {
        contractAddress = await deployFromAbiAndBytecode(
          localWeb3Provider,
          bytecodeMismatchArtifact.abi,
          bytecodeMismatchArtifact.bytecode,
          accounts[0]
        );
      });

      it("should warn the user about the issue when metadata match but not bytecodes", (done) => {
        const hardhatOutput = require("./sources/hardhat-output/extraFilesBytecodeMismatch-onlyMetadata.json");
        const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutput));

        const agent = chai.request.agent(server.app);
        agent
          .post("/session/input-files")
          .attach("files", hardhatOutputBuffer)
          .then((res) => {
            const contracts = res.body.contracts;
            contracts[0].address = contractAddress;
            contracts[0].chainId = defaultContractChain;
            agent
              .post("/session/verify-validated")
              .send({ contracts })
              .then((res) => {
                assertSingleContractStatus(res, "extra-file-input-bug");
                done();
              });
          });
      });

      it("should verify with all input files and not only those in metadata", (done) => {
        const hardhatOutput = require("./sources/hardhat-output/extraFilesBytecodeMismatch.json");
        const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutput));

        const agent = chai.request.agent(server.app);
        agent
          .post("/session/input-files")
          .attach("files", hardhatOutputBuffer)
          .then((res) => {
            const contracts = res.body.contracts;
            contracts[0].address = contractAddress;
            contracts[0].chainId = defaultContractChain;
            agent
              .post("/session/verify-validated")
              .send({ contracts })
              .then((res) => {
                assertSingleContractStatus(res, "perfect");
                done();
              });
          });
      });
    });
  });
});
