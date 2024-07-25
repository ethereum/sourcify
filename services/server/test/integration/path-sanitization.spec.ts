import chai from "chai";
import chaiHttp from "chai-http";
import { StatusCodes } from "http-status-codes";
import path from "path";
import fs from "fs";
import {
  deployFromAbiAndBytecodeForCreatorTxHash,
  deployFromAbiAndBytecode,
} from "../helpers/helpers";
import { LocalChainFixture } from "../helpers/LocalChainFixture";
import { ServerFixture } from "../helpers/ServerFixture";
import { assertVerification } from "../helpers/assertions";
import { id as keccak256str } from "ethers";

chai.use(chaiHttp);

describe("E2E test path sanitization", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  it("should sanitize the path of a source file with new line character \\n", async () => {
    const artifact = (
      await import("../testcontracts/path-sanitization-new-line/artifact.json")
    ).default;
    const { contractAddress } = await deployFromAbiAndBytecodeForCreatorTxHash(
      chainFixture.localSigner,
      artifact.abi,
      artifact.bytecode,
    );

    const metadata = (
      await import(
        path.join(
          __dirname,
          "../testcontracts/path-sanitization-new-line/metadata.json",
        )
      )
    ).default;
    const sourcePath = path.join(
      __dirname,
      "..",
      "testcontracts",
      "path-sanitization-new-line",
      "sources",
      "DFrostGeckoToken\n.sol", // with new line
    );
    const sourceBuffer = fs.readFileSync(sourcePath);

    const res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .send({
        address: contractAddress,
        chain: chainFixture.chainId,
        files: {
          "metadata.json": JSON.stringify(metadata),
          "DFrostGeckoToken\n.sol": sourceBuffer.toString(),
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
        "sources/contracts",
        "DFrostGeckoToken.sol", // without new line
      ),
    );
    chai.expect(isExist, "Path not sanitized").to.be.true;
  });

  it("should verify a contract with paths containing misc. chars, save the path translation, and be able access the file over the API", async () => {
    const sanitizeArtifact = (
      await import("../testcontracts/path-sanitization/ERC20.json")
    ).default;
    const sanitizeMetadata = (
      await import("../testcontracts/path-sanitization/metadata.json")
    ).default;
    // read all files under test/testcontracts/path-sanitization/sources/ and put them in an object
    const sanitizeSourcesObj: Record<string, Buffer> = {};
    fs.readdirSync(
      path.join(
        __dirname,
        "..",
        "testcontracts",
        "path-sanitization",
        "sources",
      ),
    ).forEach(
      (fileName) =>
        (sanitizeSourcesObj[fileName] = fs.readFileSync(
          path.join(
            __dirname,
            "..",
            "testcontracts",
            "path-sanitization",
            "sources",
            fileName,
          ),
        )),
    );

    const sanitizeMetadataBuffer = Buffer.from(
      JSON.stringify(sanitizeMetadata),
    );

    const toBeSanitizedContractAddress = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      sanitizeArtifact.abi,
      sanitizeArtifact.bytecode,
      ["TestToken", "TEST", 1000000000],
    );

    const verificationResponse = await chai
      .request(serverFixture.server.app)
      .post("/")
      .send({
        address: toBeSanitizedContractAddress,
        chain: chainFixture.chainId,
        files: {
          "metadata.json": sanitizeMetadataBuffer.toString(),
          ...sanitizeSourcesObj,
        },
      });

    chai.expect(verificationResponse.status).to.equal(StatusCodes.OK);
    chai.expect(verificationResponse.body.result[0].status).to.equal("perfect");
    const contractSavedPath = path.join(
      serverFixture.server.repository,
      "contracts",
      "full_match",
      chainFixture.chainId,
      toBeSanitizedContractAddress,
    );
    const pathTranslationPath = path.join(
      contractSavedPath,
      "path-translation.json",
    );

    let pathTranslationJSON: any;
    try {
      pathTranslationJSON = JSON.parse(
        fs.readFileSync(pathTranslationPath).toString(),
      );
    } catch (e) {
      throw new Error(
        `Path translation file not found at ${pathTranslationPath}`,
      );
    }

    // Get the contract files from the server
    const res = await chai
      .request(serverFixture.server.app)
      .get(`/files/${chainFixture.chainId}/${toBeSanitizedContractAddress}`);
    chai.expect(res.status).to.equal(StatusCodes.OK);

    // The translation path must inlude the new translated path
    const fetchedContractFiles = res.body;
    Object.keys(pathTranslationJSON).forEach((originalPath) => {
      // The metadata must have the original path
      chai
        .expect(
          sanitizeMetadata.sources,
          `Original path ${originalPath} not found in metadata`,
        )
        .to.include.keys(originalPath);

      const relativeFilePath = path.join(
        "contracts",
        "full_match",
        chainFixture.chainId,
        toBeSanitizedContractAddress,
        "sources",
        pathTranslationJSON[originalPath],
      );
      // The path from the server response must be translated
      const translatedContractObject = fetchedContractFiles.find(
        (obj: any) => obj.path === relativeFilePath,
      );
      chai.expect(translatedContractObject).to.exist;
      // And the saved file must be the same as in the metadata
      const sanitizeMetadataSources = sanitizeMetadata.sources as Record<
        string,
        { keccak256: string }
      >;
      chai
        .expect(
          sanitizeMetadataSources[originalPath].keccak256,
          `Keccak of ${originalPath} does not match ${translatedContractObject.path}`,
        )
        .to.equal(keccak256str(translatedContractObject.content));
    });
  });

  it("should not save path translation if the path is not sanitized", (done) => {
    deployFromAbiAndBytecode(
      chainFixture.localSigner,
      chainFixture.defaultContractArtifact.abi,
      chainFixture.defaultContractArtifact.bytecode,
    ).then((contractAddress) => {
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
        .end(async (err, res) => {
          await assertVerification(
            serverFixture.sourcifyDatabase,
            err,
            res,
            null,
            chainFixture.defaultContractAddress,
            chainFixture.chainId,
            "perfect",
          );
          const contractSavedPath = path.join(
            serverFixture.server.repository,
            "contracts",
            "full_match",
            chainFixture.chainId,
            contractAddress,
          );
          const pathTranslationPath = path.join(
            contractSavedPath,
            "path-translation.json",
          );
          chai.expect(fs.existsSync(pathTranslationPath)).to.be.false;
          done();
        });
    });
  });
});
