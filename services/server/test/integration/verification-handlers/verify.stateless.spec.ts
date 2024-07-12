import {
  assertValidationError,
  assertVerification,
} from "../../helpers/assertions";
import chai from "chai";
import chaiHttp from "chai-http";
import { StatusCodes } from "http-status-codes";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";
import type { Done } from "mocha";
import type { Response } from "superagent";
import path from "path";
import fs from "fs";
import {
  waitSecs,
  deployFromAbiAndBytecodeForCreatorTxHash,
  deployFromAbiAndBytecode,
} from "../../helpers/helpers";
import hardhatOutputJSON from "../../sources/hardhat-output/output.json";

chai.use(chaiHttp);

describe("/", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  const checkNonVerified = (path: string, done: Done) => {
    chai
      .request(serverFixture.server.app)
      .post(path)
      .field("chain", chainFixture.chainId)
      .field("address", chainFixture.defaultContractAddress)
      .end((err, res) => {
        chai.expect(err).to.be.null;
        chai.expect(res.body).to.haveOwnProperty("error");
        chai.expect(res.status).to.equal(StatusCodes.NOT_FOUND);
        done();
      });
  };

  it("should correctly inform for an address check of a non verified contract (at /)", (done) => {
    checkNonVerified("/", done);
  });

  it("should correctly inform for an address check of a non verified contract (at /verify)", (done) => {
    checkNonVerified("/verify", done);
  });

  it("should verify multipart upload", (done) => {
    chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach("files", chainFixture.defaultContractMetadata, "metadata.json")
      .attach("files", chainFixture.defaultContractSource, "Storage.sol")
      .end(
        async (err, res) =>
          await assertVerification(
            serverFixture.sourcifyDatabase,
            err,
            res,
            done,
            chainFixture.defaultContractAddress,
            chainFixture.chainId,
            "perfect",
          ),
      );
  });

  it("should verify json upload with string properties", (done) => {
    chai
      .request(serverFixture.server.app)
      .post("/")
      .send({
        address: chainFixture.defaultContractAddress,
        chain: chainFixture.chainId,
        files: {
          "metadata.json": chainFixture.defaultContractMetadata.toString(),
          "Storage.sol": chainFixture.defaultContractSource.toString(),
        },
      })
      .end(
        async (err, res) =>
          await assertVerification(
            serverFixture.sourcifyDatabase,
            err,
            res,
            done,
            chainFixture.defaultContractAddress,
            chainFixture.chainId,
            "perfect",
          ),
      );
  });

  it("should verify json upload with Buffer properties", (done) => {
    chai
      .request(serverFixture.server.app)
      .post("/")
      .send({
        address: chainFixture.defaultContractAddress,
        chain: chainFixture.chainId,
        files: {
          "metadata.json": chainFixture.defaultContractMetadata,
          "Storage.sol": chainFixture.defaultContractSource,
        },
      })
      .end(
        async (err, res) =>
          await assertVerification(
            serverFixture.sourcifyDatabase,
            err,
            res,
            done,
            chainFixture.defaultContractAddress,
            chainFixture.chainId,
            "perfect",
          ),
      );
  });

  const assertMissingFile = (err: Error, res: Response) => {
    chai.expect(err).to.be.null;
    chai.expect(res.body).to.haveOwnProperty("error");
    const errorMessage = res.body.error.toLowerCase();
    chai.expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    chai.expect(errorMessage).to.include("missing");
    chai.expect(errorMessage).to.include("Storage".toLowerCase());
  };

  it("should return Bad Request Error for a source that is missing and unfetchable", (done) => {
    chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach(
        "files",
        chainFixture.defaultContractModifiedSourceIpfs,
        "metadata.json",
      )
      .end((err, res) => {
        assertMissingFile(err, res);
        done();
      });
  });

  it("should fetch a missing file that is accessible via ipfs", (done) => {
    chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach("files", chainFixture.defaultContractMetadata, "metadata.json")
      .end(
        async (err, res) =>
          await assertVerification(
            serverFixture.sourcifyDatabase,
            err,
            res,
            done,
            chainFixture.defaultContractAddress,
            chainFixture.chainId,
            "perfect",
          ),
      );
  });

  it("Should upgrade match from 'partial' to 'full', delete partial from repository and update creationTx information in database", async () => {
    const partialMetadata = (
      await import("../../testcontracts/Storage/metadataModified.json")
    ).default;
    const partialMetadataBuffer = Buffer.from(JSON.stringify(partialMetadata));

    const partialSourcePath = path.join(
      __dirname,
      "..",
      "..",
      "testcontracts",
      "Storage",
      "StorageModified.sol",
    );
    const partialSourceBuffer = fs.readFileSync(partialSourcePath);

    const partialMetadataURL = `/repository/contracts/partial_match/${chainFixture.chainId}/${chainFixture.defaultContractAddress}/metadata.json`;

    let res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach("files", partialMetadataBuffer, "metadata.json")
      .attach("files", partialSourceBuffer);
    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      res,
      null,
      chainFixture.defaultContractAddress,
      chainFixture.chainId,
      "partial",
    );

    res = await chai.request(serverFixture.server.app).get(partialMetadataURL);
    chai.expect(res.body).to.deep.equal(partialMetadata);

    const contractDeploymentWithoutCreatorTransactionHash =
      await serverFixture.sourcifyDatabase.query(
        "SELECT transaction_hash, block_number, transaction_index, contract_id FROM contract_deployments",
      );

    const contractIdWithoutCreatorTransactionHash =
      contractDeploymentWithoutCreatorTransactionHash?.rows[0].contract_id;
    chai
      .expect(contractDeploymentWithoutCreatorTransactionHash?.rows[0])
      .to.deep.equal({
        transaction_hash: null,
        block_number: null,
        transaction_index: null,
        contract_id: contractIdWithoutCreatorTransactionHash,
      });

    res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .field("creatorTxHash", chainFixture.defaultContractCreatorTx)
      .attach("files", chainFixture.defaultContractMetadata, "metadata.json")
      .attach("files", chainFixture.defaultContractSource);
    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      res,
      null,
      chainFixture.defaultContractAddress,
      chainFixture.chainId,
    );

    const contractDeploymentWithCreatorTransactionHash =
      await serverFixture.sourcifyDatabase.query(
        "SELECT encode(transaction_hash, 'hex') as transaction_hash, block_number, transaction_index, contract_id FROM contract_deployments",
      );

    const contractIdWithCreatorTransactionHash =
      contractDeploymentWithCreatorTransactionHash?.rows[0].contract_id;

    // There should be a new contract_id
    chai
      .expect(contractIdWithCreatorTransactionHash)
      .to.not.equal(contractIdWithoutCreatorTransactionHash);

    // Creator transaction information must be used after update
    chai
      .expect(contractDeploymentWithCreatorTransactionHash?.rows[0])
      .to.deep.equal({
        transaction_hash: chainFixture.defaultContractCreatorTx.substring(2),
        block_number: "1",
        transaction_index: "0",
        contract_id: contractIdWithCreatorTransactionHash,
      });

    await waitSecs(2); // allow server some time to execute the deletion (it started *after* the last response)

    res = await chai.request(serverFixture.server.app).get(partialMetadataURL);
    chai.expect(res.status).to.equal(StatusCodes.NOT_FOUND);
  });

  it("should return 'partial', then throw when another 'partial' match is received", async () => {
    const partialMetadata = (
      await import("../../testcontracts/Storage/metadataModified.json")
    ).default;
    const partialMetadataBuffer = Buffer.from(JSON.stringify(partialMetadata));

    const partialSourcePath = path.join(
      __dirname,
      "..",
      "..",
      "testcontracts",
      "Storage",
      "StorageModified.sol",
    );
    const partialSourceBuffer = fs.readFileSync(partialSourcePath);

    const partialMetadataURL = `/repository/contracts/partial_match/${chainFixture.chainId}/${chainFixture.defaultContractAddress}/metadata.json`;

    let res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach("files", partialMetadataBuffer, "metadata.json")
      .attach("files", partialSourceBuffer);
    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      res,
      null,
      chainFixture.defaultContractAddress,
      chainFixture.chainId,
      "partial",
    );

    res = await chai.request(serverFixture.server.app).get(partialMetadataURL);
    chai.expect(res.body).to.deep.equal(partialMetadata);

    res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", chainFixture.defaultContractAddress)
      .field("chain", chainFixture.chainId)
      .attach("files", partialMetadataBuffer, "metadata.json")
      .attach("files", partialSourceBuffer);

    chai.expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    chai
      .expect(res.body.error)
      .to.equal(
        `The contract ${chainFixture.defaultContractAddress} on chainId ${chainFixture.chainId} is already partially verified. The provided new source code also yielded a partial match and will not be stored unless it's a full match`,
      );
  });

  it("should mark contracts without an embedded metadata hash as a 'partial' match", async () => {
    // Simple contract without bytecode at https://goerli.etherscan.io/address/0x093203902B71Cdb1dAA83153b3Df284CD1a2f88d
    const bytecode =
      "0x6080604052348015600f57600080fd5b50601680601d6000396000f3fe6080604052600080fdfea164736f6c6343000700000a";
    const metadataPath = path.join(
      __dirname,
      "..",
      "..",
      "sources",
      "metadata",
      "withoutMetadataHash.meta.object.json",
    );
    const metadataBuffer = fs.readFileSync(metadataPath);
    const metadata = JSON.parse(metadataBuffer.toString());
    const address = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      metadata.output.abi,
      bytecode,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", address)
      .field("chain", chainFixture.chainId)
      .attach("files", metadataBuffer, "metadata.json");

    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      res,
      null,
      address,
      chainFixture.chainId,
      "partial",
    );
  });

  it("should verify a contract with immutables and save immutable-references.json", async () => {
    const artifact = (
      await import("../../testcontracts/WithImmutables/artifact.json")
    ).default;
    const { contractAddress } = await deployFromAbiAndBytecodeForCreatorTxHash(
      chainFixture.localSigner,
      artifact.abi,
      artifact.bytecode,
      [999],
    );

    const metadata = (
      await import(
        path.join(__dirname, "../../testcontracts/WithImmutables/metadata.json")
      )
    ).default;
    const sourcePath = path.join(
      __dirname,
      "..",
      "..",
      "testcontracts",
      "WithImmutables",
      "sources",
      "WithImmutables.sol",
    );
    const sourceBuffer = fs.readFileSync(sourcePath);

    // Now pass the creatorTxHash
    const res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .send({
        address: contractAddress,
        chain: chainFixture.chainId,
        files: {
          "metadata.json": JSON.stringify(metadata),
          "WithImmutables.sol": sourceBuffer.toString(),
        },
      });
    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      res,
      null,
      contractAddress,
      chainFixture.chainId,
    );
    const isExist = fs.existsSync(
      path.join(
        serverFixture.server.repository,
        "contracts",
        "full_match",
        chainFixture.chainId,
        contractAddress,
        "immutable-references.json",
      ),
    );
    chai.expect(isExist, "Immutable references not saved").to.be.true;
  });

  it("should store the correct/recompiled metadata file if a wrong metadata input yields a match", async () => {
    // Mimics contract 0x1CA8C2B9B20E18e86d5b9a72370fC6c91814c97C on Optimism (10)
    const artifact = (
      await import(
        path.join(
          __dirname,
          "../../testcontracts/ensure-metadata-storage/EIP1967Proxy.json",
        )
      )
    ).default;
    const wrongMetadata = (
      await import(
        path.join(
          __dirname,
          "../../testcontracts/ensure-metadata-storage/wrong-metadata.json",
        )
      )
    ).default;
    const correctMetadata = (
      await import(
        path.join(
          __dirname,
          "../../testcontracts/ensure-metadata-storage/correct-metadata.json",
        )
      )
    ).default;
    const source1Buffer = fs.readFileSync(
      path.join(
        __dirname,
        "../../testcontracts/ensure-metadata-storage/EIP1967Proxy.sol",
      ),
    );
    const source2Buffer = fs.readFileSync(
      path.join(
        __dirname,
        "../../testcontracts/ensure-metadata-storage/EIP1967Admin.sol",
      ),
    );
    const contractAddress = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      correctMetadata.output.abi,
      artifact.bytecode,
      [
        "0x39f0bd56c1439a22ee90b4972c16b7868d161981",
        "0x000000000000000000000000000000000000dead",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    );

    const verifyRes = await chai
      .request(serverFixture.server.app)
      .post("/")
      .send({
        address: contractAddress,
        chain: chainFixture.chainId,
        files: {
          "metadata.json": JSON.stringify(wrongMetadata),
          "EIP1967Proxy.sol": source1Buffer.toString(),
          "EIP1967Admin.sol": source2Buffer.toString(),
        },
      });

    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      verifyRes,
      null,
      contractAddress,
      chainFixture.chainId,
      "perfect",
    );

    const filesRes = await chai
      .request(serverFixture.server.app)
      .get(`/files/${chainFixture.chainId}/${contractAddress}`);
    const files: Array<Record<string, string>> = filesRes.body;
    const receivedMetadata = files.find(
      (file) => file.name === "metadata.json",
    );
    chai.expect(receivedMetadata).not.to.be.undefined;
    chai
      .expect(receivedMetadata!.content)
      .to.equal(JSON.stringify(correctMetadata));
  });

  describe("solc standard input json", () => {
    it("should return validation error for adding standard input JSON without a compiler version", async () => {
      const address = await deployFromAbiAndBytecode(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi, // Storage.sol
        chainFixture.defaultContractArtifact.bytecode,
      );
      const solcJsonPath = path.join(
        __dirname,
        "..",
        "..",
        "testcontracts",
        "Storage",
        "StorageJsonInput.json",
      );
      const solcJsonBuffer = fs.readFileSync(solcJsonPath);

      const res = await chai
        .request(serverFixture.server.app)
        .post("/verify/solc-json")
        .attach("files", solcJsonBuffer, "solc.json")
        .field("address", address)
        .field("chain", chainFixture.chainId)
        .field("contractName", "Storage");

      assertValidationError(null, res, "compilerVersion");
    });

    it("should return validation error for adding standard input JSON without a contract name", async () => {
      const address = await deployFromAbiAndBytecode(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi, // Storage.sol
        chainFixture.defaultContractArtifact.bytecode,
      );
      const solcJsonPath = path.join(
        __dirname,
        "..",
        "..",
        "testcontracts",
        "Storage",
        "StorageJsonInput.json",
      );
      const solcJsonBuffer = fs.readFileSync(solcJsonPath);

      const res = await chai
        .request(serverFixture.server.app)
        .post("/verify/solc-json")
        .attach("files", solcJsonBuffer)
        .field("address", address)
        .field("chain", chainFixture.chainId)
        .field("compilerVersion", "0.8.4+commit.c7e474f2");

      assertValidationError(null, res, "contractName");
    });

    it("should verify a contract with Solidity standard input JSON", async () => {
      const address = await deployFromAbiAndBytecode(
        chainFixture.localSigner,
        chainFixture.defaultContractArtifact.abi, // Storage.sol
        chainFixture.defaultContractArtifact.bytecode,
      );
      const solcJsonPath = path.join(
        __dirname,
        "..",
        "..",
        "testcontracts",
        "Storage",
        "StorageJsonInput.json",
      );
      const solcJsonBuffer = fs.readFileSync(solcJsonPath);

      const res = await chai
        .request(serverFixture.server.app)
        .post("/verify/solc-json")
        .attach("files", solcJsonBuffer, "solc.json")
        .field("address", address)
        .field("chain", chainFixture.chainId)
        .field("compilerVersion", "0.8.4+commit.c7e474f2")
        .field("contractName", "Storage");

      await assertVerification(
        serverFixture.sourcifyDatabase,
        null,
        res,
        null,
        address,
        chainFixture.chainId,
      );
    });
  });

  describe("hardhat build-info file support", function () {
    let address: string;
    const mainContractIndex = 5;
    const MyToken =
      hardhatOutputJSON.output.contracts["contracts/MyToken.sol"].MyToken;
    const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutputJSON));
    before(async function () {
      address = await deployFromAbiAndBytecode(
        chainFixture.localSigner,
        MyToken.abi,
        MyToken.evm.bytecode.object,
        ["Sourcify Hardhat Test", "TEST"],
      );
      console.log(`Contract deployed at ${address}`);
      await waitSecs(3);
    });

    it("should detect multiple contracts in the build-info file", (done) => {
      chai
        .request(serverFixture.server.app)
        .post("/")
        .field("chain", chainFixture.chainId)
        .field("address", address)
        .attach("files", hardhatOutputBuffer)
        .then((res) => {
          chai.expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
          chai.expect(res.body.contractsToChoose.length).to.be.equal(6);
          chai
            .expect(res.body.error)
            .to.be.a("string")
            .and.satisfy((msg: string) => msg.startsWith("Detected "));
          done();
        });
    });

    it("should verify the chosen contract in the build-info file", (done) => {
      chai
        .request(serverFixture.server.app)
        .post("/")
        .field("chain", chainFixture.chainId)
        .field("address", address)
        .field("chosenContract", mainContractIndex)
        .attach("files", hardhatOutputBuffer)
        .end(async (err, res) => {
          await assertVerification(
            serverFixture.sourcifyDatabase,
            err,
            res,
            done,
            address,
            chainFixture.chainId,
            "perfect",
          );
        });
    });

    it("should store a contract in /contracts/full_match|partial_match/0xADDRESS despite the files paths in the metadata", async () => {
      const { contractAddress } =
        await deployFromAbiAndBytecodeForCreatorTxHash(
          chainFixture.localSigner,
          chainFixture.defaultContractArtifact.abi,
          chainFixture.defaultContractArtifact.bytecode,
          [],
        );
      const metadata = (
        await import("../../testcontracts/Storage/metadata.upMultipleDirs.json")
      ).default;

      // Now pass the creatorTxHash
      const res = await chai
        .request(serverFixture.server.app)
        .post("/")
        .send({
          address: contractAddress,
          chain: chainFixture.chainId,
          files: {
            "metadata.json": JSON.stringify(metadata),
            "Storage.sol": chainFixture.defaultContractSource.toString(),
          },
        });
      await assertVerification(
        serverFixture.sourcifyDatabase,
        null,
        res,
        null,
        contractAddress,
        chainFixture.chainId,
        "partial",
      );
      const isExist = fs.existsSync(
        path.join(
          serverFixture.server.repository,
          "contracts",
          "partial_match",
          chainFixture.chainId,
          contractAddress,
          "sources",
          "Storage.sol",
        ),
      );
      chai.expect(isExist, "Files saved in the wrong directory").to.be.true;
    });
  });

  describe("solc v0.6.12 and v0.7.0 extra files in compilation causing metadata match but bytecode mismatch", function () {
    // Deploy the test contract locally
    // Contract from https://explorer.celo.org/address/0x923182024d0Fa5dEe59E3c3db5e2eeD23728D3C3/contracts
    let contractAddress: string;

    before(async () => {
      const bytecodeMismatchArtifact = (
        await import("../../sources/artifacts/extraFilesBytecodeMismatch.json")
      ).default;
      contractAddress = await deployFromAbiAndBytecode(
        chainFixture.localSigner,
        bytecodeMismatchArtifact.abi,
        bytecodeMismatchArtifact.bytecode,
      );
    });

    it("should warn the user about the issue when metadata match but not bytecodes", (done) => {
      import(
        "../../sources/hardhat-output/extraFilesBytecodeMismatch-onlyMetadata.json"
      ).then((hardhatOutput) => {
        const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutput));
        chai
          .request(serverFixture.server.app)
          .post("/")
          .field("chain", chainFixture.chainId)
          .field("address", contractAddress)
          .attach("files", hardhatOutputBuffer)
          .end((err, res) => {
            chai.expect(res.status).to.equal(500);
            chai.expect(res.body).to.deep.equal({
              error:
                "It seems your contract's metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618",
            });
            done();
          });
      });
    });

    it("should verify with all input files and not only those in metadata", (done) => {
      import(
        "../../sources/hardhat-output/extraFilesBytecodeMismatch.json"
      ).then((hardhatOutput) => {
        const hardhatOutputBuffer = Buffer.from(JSON.stringify(hardhatOutput));
        chai
          .request(serverFixture.server.app)
          .post("/")
          .field("chain", chainFixture.chainId)
          .field("address", contractAddress)
          .attach("files", hardhatOutputBuffer)
          .end(async (err, res) => {
            await assertVerification(
              serverFixture.sourcifyDatabase,
              err,
              res,
              done,
              contractAddress,
              chainFixture.chainId,
              "perfect",
            );
          });
      });
    });
  });

  it("should verify a contract compiled with Solidity < 0.7.5 and libraries have been linked using compiler settings", async () => {
    const artifact = (
      await import(
        "../../testcontracts/LibrariesSolidity075/LibrariesSolidity075.json"
      )
    ).default;
    const address = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      artifact.abi,
      artifact.bytecode,
    );

    const metadata = (
      await import("../../testcontracts/LibrariesSolidity075/metadata.json")
    ).default;

    const file = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "..",
        "testcontracts",
        "LibrariesSolidity075",
        "Example.sol",
      ),
    );

    const res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", address)
      .field("chain", chainFixture.chainId)
      .attach("files", Buffer.from(JSON.stringify(metadata)), "metadata.json")
      .attach("files", file, "Example.sol");

    await assertVerification(
      serverFixture.sourcifyDatabase,
      null,
      res,
      null,
      address,
      chainFixture.chainId,
      "perfect",
    );
  });
});
