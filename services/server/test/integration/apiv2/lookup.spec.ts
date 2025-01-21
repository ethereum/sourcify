import chai from "chai";
import chaiHttp from "chai-http";
import {
  deployAndVerifyContract,
  deployFromAbiAndBytecode,
  deployFromAbiAndBytecodeForCreatorTxHash,
  verifyContract,
} from "../../helpers/helpers";
import { LocalChainFixture } from "../../helpers/LocalChainFixture";
import { ServerFixture } from "../../helpers/ServerFixture";
import type { Response } from "superagent";
import path from "path";
import fs from "fs";

chai.use(chaiHttp);

describe("GET /v2/contracts/:chainId", function () {
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
      matchId: "1",
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
      matchId: "1",
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

    // Test limit
    const res0 = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}?limit=3`);
    chai.expect(res0.body.results).to.be.an.instanceOf(Array);
    chai.expect(res0.body.results.length).to.equal(3);
    chai.expect(res0.body.results[0].matchId).to.equal("5");
    chai.expect(res0.body.results[1].matchId).to.equal("4");
    chai.expect(res0.body.results[2].matchId).to.equal("3");

    // Test afterMatchId with desc
    const res1 = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}?limit=2&afterMatchId=4`);
    chai.expect(res1.body.results[0].matchId).to.equal("3");
    chai.expect(res1.body.results[1].matchId).to.equal("2");

    // Test afterMatchId with asc
    const res2 = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}?limit=2&afterMatchId=1&sort=asc`,
      );
    chai.expect(res2.body.results[0].matchId).to.equal("2");
    chai.expect(res2.body.results[1].matchId).to.equal("3");

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
        matchId: (i + 1).toString(),
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
        matchId: (newestContractsFirst.length - i).toString(),
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

describe("GET /v2/contracts/:chainId/:address", function () {
  const chainFixture = new LocalChainFixture();
  const serverFixture = new ServerFixture();

  const optionalFields = [
    "creationBytecode",
    "runtimeBytecode",
    "deployment",
    "sources",
    "compilation",
    "abi",
    "metadata",
    "storageLayout",
    "userDoc",
    "devDoc",
    "stdJsonInput",
    "stdJsonOutput",
    "proxyResolution",
  ];

  const assertGetContractResponse = (
    res: Response,
    deploymentInfo: {
      contractAddress: string;
      txHash?: string;
      blockNumber?: number;
      txIndex?: number;
    },
    requestedFields: string[] = [],
  ) => {
    chai.expect(res.status).to.equal(200);
    chai.expect(res.body).to.include({
      match: "exact_match",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
      chainId: chainFixture.chainId,
      address: deploymentInfo.contractAddress,
      matchId: "1",
    });
    chai.expect(res.body).to.have.property("verifiedAt");
    const requestedPrimaryFields = requestedFields.map(
      (field) => field.split(".")[0],
    );
    chai
      .expect(res.body)
      .to.not.have.any.keys(
        optionalFields.filter(
          (field) => !requestedPrimaryFields.includes(field),
        ),
      );

    const contractPath = Object.keys(
      chainFixture.defaultContractMetadataObject.settings.compilationTarget,
    )[0];
    for (const field of requestedFields) {
      const splitField = field.split(".");
      if (splitField.length > 2) {
        throw new Error(
          "Malformed test. Fields should not have more than two parts.",
        );
      }
      const [primaryField, subField] = splitField;
      let objectToExpect;
      switch (primaryField) {
        case "creationBytecode":
          objectToExpect = {
            onchainBytecode: chainFixture.defaultContractArtifact.bytecode,
            recompiledBytecode: chainFixture.defaultContractArtifact.bytecode,
            sourceMap: chainFixture.defaultContractArtifact.sourceMap,
            linkReferences: chainFixture.defaultContractArtifact.linkReferences,
            cborAuxdata: chainFixture.defaultContractArtifact.cborAuxdata,
            transformations: [],
            transformationValues: {},
          };
          break;
        case "runtimeBytecode":
          objectToExpect = {
            onchainBytecode:
              chainFixture.defaultContractArtifact.deployedBytecode,
            recompiledBytecode:
              chainFixture.defaultContractArtifact.deployedBytecode,
            sourceMap: chainFixture.defaultContractArtifact.deployedSourceMap,
            linkReferences:
              chainFixture.defaultContractArtifact.deployedLinkReferences,
            cborAuxdata:
              chainFixture.defaultContractArtifact.deployedCborAuxdata,
            immutableReferences:
              chainFixture.defaultContractArtifact.immutableReferences,
            transformations: [],
            transformationValues: {},
          };
          break;
        case "deployment":
          if (
            !deploymentInfo.txHash ||
            !deploymentInfo.blockNumber ||
            !deploymentInfo.txIndex
          ) {
            throw new Error("Malformed test. Deployment info is missing.");
          }
          objectToExpect = {
            transactionHash: deploymentInfo.txHash,
            blockNumber: deploymentInfo.blockNumber,
            txIndex: deploymentInfo.txIndex,
            deployer: chainFixture.localSigner.address,
          };
          break;
        case "sources":
          if (subField) {
            throw new Error(
              "Malformed test. Sources should not have subfields.",
            );
          }
          objectToExpect = {
            [contractPath]: {
              content: chainFixture.defaultContractSource.toString(),
            },
          };
          break;
        case "compilation":
          objectToExpect = {
            language: chainFixture.defaultContractMetadataObject.language,
            compiler: chainFixture.defaultContractArtifact.compiler.name,
            compilerVersion:
              chainFixture.defaultContractArtifact.compiler.version,
            compilerSettings:
              chainFixture.defaultContractMetadataObject.settings,
            name: chainFixture.defaultContractArtifact.contractName,
            fullyQualifiedName: `${contractPath}:${chainFixture.defaultContractArtifact.contractName}`,
          };
          break;
        case "abi":
          if (subField) {
            throw new Error("Malformed test. ABI should not have subfields.");
          }
          objectToExpect = chainFixture.defaultContractArtifact.abi;
          break;
        case "metadata":
          if (subField) {
            throw new Error(
              "Malformed test. Metadata should not have subfields.",
            );
          }
          objectToExpect = chainFixture.defaultContractMetadataObject;
          break;
        case "storageLayout":
          if (subField) {
            throw new Error(
              "Malformed test. StorageLayout should not have subfields.",
            );
          }
          objectToExpect = chainFixture.defaultContractArtifact.storageLayout;
          break;
        case "userDoc":
          if (subField) {
            throw new Error(
              "Malformed test. UserDoc should not have subfields.",
            );
          }
          objectToExpect = chainFixture.defaultContractArtifact.userdoc;
          break;
        case "devDoc":
          if (subField) {
            throw new Error(
              "Malformed test. DevDoc should not have subfields.",
            );
          }
          objectToExpect = chainFixture.defaultContractArtifact.devdoc;
          break;
        case "stdJsonInput":
          if (subField) {
            throw new Error(
              "Malformed test. StdJsonInput should not have subfields.",
            );
          }
          objectToExpect = {
            language: chainFixture.defaultContractMetadataObject.language,
            sources: {
              [contractPath]: {
                content: chainFixture.defaultContractSource.toString(),
              },
            },
            settings: chainFixture.defaultContractMetadataObject.settings,
          };
          break;
        case "stdJsonOutput":
          if (subField) {
            throw new Error(
              "Malformed test. StdJsonOutput should not have subfields.",
            );
          }
          objectToExpect = {
            sources: {
              [contractPath]: {
                id: 1,
                ast: chainFixture.defaultContractArtifact.ast,
              },
            },
            contracts: {
              [contractPath]: {
                [chainFixture.defaultContractArtifact.contractName]: {
                  abi: chainFixture.defaultContractArtifact.abi,
                  metadata: chainFixture.defaultContractArtifact.metadata,
                  userdoc: chainFixture.defaultContractArtifact.userdoc,
                  devdoc: chainFixture.defaultContractArtifact.devdoc,
                  storageLayout:
                    chainFixture.defaultContractArtifact.storageLayout,
                  evm: {
                    legacyAssembly:
                      chainFixture.defaultContractArtifact.legacyAssembly,
                    bytecode: {
                      object: chainFixture.defaultContractArtifact.bytecode,
                      sourceMap: chainFixture.defaultContractArtifact.sourceMap,
                      linkReferences:
                        chainFixture.defaultContractArtifact.linkReferences,
                      generatedSources:
                        chainFixture.defaultContractArtifact.generatedSources,
                    },
                    deployedBytecode: {
                      object:
                        chainFixture.defaultContractArtifact.deployedBytecode,
                      sourceMap:
                        chainFixture.defaultContractArtifact.deployedSourceMap,
                      linkReferences:
                        chainFixture.defaultContractArtifact
                          .deployedLinkReferences,
                      immutableReferences:
                        chainFixture.defaultContractArtifact
                          .immutableReferences,
                    },
                  },
                },
              },
            },
          };
          break;
        case "proxyResolution":
          if (subField) {
            throw new Error(
              "Malformed test. ProxyResolution should not have subfields.",
            );
          }
          objectToExpect = {
            isProxy: false,
            proxyType: null,
            implementations: [],
          };
          break;
      }
      if (subField) {
        chai
          .expect(res.body)
          .to.have.deep.nested.property(field, objectToExpect);
      } else {
        chai
          .expect(res.body)
          .to.have.deep.property(primaryField, objectToExpect);
      }
    }
  };

  it("should return minimal information for a verified contract by default", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}/${contractAddress}`);

    assertGetContractResponse(res, { contractAddress });
  });

  it("should return creationBytecode information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=creationBytecode`,
      );

    assertGetContractResponse(res, { contractAddress }, ["creationBytecode"]);
  });

  it("should return runtimeBytecode information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=runtimeBytecode`,
      );

    assertGetContractResponse(res, { contractAddress }, ["runtimeBytecode"]);
  });

  it("should return deployment information when requested", async function () {
    const deploymentInfo = await deployFromAbiAndBytecodeForCreatorTxHash(
      chainFixture.localSigner,
      chainFixture.defaultContractArtifact.abi,
      chainFixture.defaultContractArtifact.bytecode,
      [],
    );
    await verifyContract(
      serverFixture,
      chainFixture,
      deploymentInfo.contractAddress,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${deploymentInfo.contractAddress}?fields=deployment`,
      );

    assertGetContractResponse(res, deploymentInfo, ["deployment"]);
  });

  it("should return sources information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=sources`,
      );

    assertGetContractResponse(res, { contractAddress }, ["sources"]);
  });

  it("should return compilation information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=compilation`,
      );

    assertGetContractResponse(res, { contractAddress }, ["compilation"]);
  });

  it("should return abi information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=abi`,
      );

    assertGetContractResponse(res, { contractAddress }, ["abi"]);
  });

  it("should return metadata information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=metadata`,
      );

    assertGetContractResponse(res, { contractAddress }, ["metadata"]);
  });

  it("should return storageLayout information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=storageLayout`,
      );

    assertGetContractResponse(res, { contractAddress }, ["storageLayout"]);
  });

  it("should return userDoc information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=userDoc`,
      );

    assertGetContractResponse(res, { contractAddress }, ["userDoc"]);
  });

  it("should return devDoc information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=devDoc`,
      );

    assertGetContractResponse(res, { contractAddress }, ["devDoc"]);
  });

  it("should return stdJsonInput information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=stdJsonInput`,
      );

    assertGetContractResponse(res, { contractAddress }, ["stdJsonInput"]);
  });

  it("should return stdJsonOutput information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=stdJsonOutput`,
      );

    assertGetContractResponse(res, { contractAddress }, ["stdJsonOutput"]);
  });

  it("should return proxyResolution information when requested", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=proxyResolution`,
      );

    assertGetContractResponse(res, { contractAddress }, ["proxyResolution"]);
  });

  it("should correctly detect proxy contracts", async function () {
    const proxyArtifact = (
      await import("../../testcontracts/Proxy/Proxy_flattened.json")
    ).default;
    const proxyMetadata = (
      await import("../../testcontracts/Proxy/metadata.json")
    ).default;
    const proxySource = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "testcontracts",
        "Proxy",
        "Proxy_flattened.sol",
      ),
    );

    const logicAddress = chainFixture.defaultContractAddress;
    const contractAddress = await deployFromAbiAndBytecode(
      chainFixture.localSigner,
      proxyArtifact.abi,
      proxyArtifact.bytecode,
      [logicAddress, chainFixture.localSigner.address, "0x"],
    );
    let res = await chai
      .request(serverFixture.server.app)
      .post("/")
      .field("address", contractAddress)
      .field("chain", chainFixture.chainId)
      .attach(
        "files",
        Buffer.from(JSON.stringify(proxyMetadata)),
        "metadata.json",
      )
      .attach("files", proxySource, "Proxy_flattened.sol");
    chai.expect(res.status).to.equal(200);

    res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=proxyResolution`,
      );

    chai.expect(res.status).to.equal(200);
    chai.expect(res.body).to.have.deep.property("proxyResolution", {
      isProxy: true,
      proxyType: "EIP1967Proxy",
      implementations: [{ address: logicAddress }],
    });
  });

  it("should return all fields when requested", async function () {
    const deploymentInfo = await deployFromAbiAndBytecodeForCreatorTxHash(
      chainFixture.localSigner,
      chainFixture.defaultContractArtifact.abi,
      chainFixture.defaultContractArtifact.bytecode,
      [],
    );
    await verifyContract(
      serverFixture,
      chainFixture,
      deploymentInfo.contractAddress,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${deploymentInfo.contractAddress}?fields=${optionalFields.join(",")}`,
      );

    assertGetContractResponse(res, deploymentInfo, optionalFields);
  });

  it("should return all fields but the omitted ones when requested", async function () {
    const omittedFields = ["proxyResolution", "deployment"];

    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?omit=${omittedFields.join(",")}`,
      );

    assertGetContractResponse(
      res,
      { contractAddress },
      optionalFields.filter((field) => !omittedFields.includes(field)),
    );
  });

  it("should allow for selecting subproperties of a field", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?field=creationBytecode.sourceMap,creationBytecode.onchainBytecode`,
      );

    assertGetContractResponse(res, { contractAddress }, [
      "creationBytecode.sourceMap",
      "creationBytecode.onchainBytecode",
    ]);
  });

  it("should allow for deselecting subproperties of a field", async function () {
    const deploymentInfo = await deployFromAbiAndBytecodeForCreatorTxHash(
      chainFixture.localSigner,
      chainFixture.defaultContractArtifact.abi,
      chainFixture.defaultContractArtifact.bytecode,
      [],
    );
    await verifyContract(
      serverFixture,
      chainFixture,
      deploymentInfo.contractAddress,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${deploymentInfo.contractAddress}?omit=deployment.transactionHash,deployment.blockNumber`,
      );

    assertGetContractResponse(
      res,
      deploymentInfo,
      optionalFields
        .filter((field) => field !== "deployment")
        .concat(["deployment.txIndex", "deployment.deployer"]),
    );
  });

  it("should ignore unknown fields", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=unknown`,
      );

    assertGetContractResponse(res, { contractAddress });
  });

  it("should return a 400 when omit and fields parameters are provided at the same time", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?omit=userDoc&fields=creationBytecode`,
      );

    chai.expect(res.status).to.equal(400);
    chai.expect(res.body.customCode).to.equal("invalid_parameter");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");
  });

  it("should return a 400 when invalid subproperties for fields are selected", async function () {
    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    let res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=abi.name`,
      );

    chai.expect(res.status).to.equal(400);
    chai.expect(res.body.customCode).to.equal("invalid_parameter");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");

    res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?omit=sources.Storage`,
      );

    chai.expect(res.status).to.equal(400);
    chai.expect(res.body.customCode).to.equal("invalid_parameter");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");

    res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/${contractAddress}?fields=creationBytecode.onchainBytecode.linkReferences`,
      );

    chai.expect(res.status).to.equal(400);
    chai.expect(res.body.customCode).to.equal("invalid_parameter");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");
  });

  it("should return a 404 when the chain is not found", async function () {
    const unknownChainId = "5";

    // Make sure chain is not found
    const chainMap = serverFixture.server.chainRepository.sourcifyChainMap;
    const chainToRestore = chainMap[unknownChainId];
    delete chainMap[unknownChainId];

    const contractAddress = await deployAndVerifyContract(
      chainFixture,
      serverFixture,
    );

    const res = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${unknownChainId}/${contractAddress}`);

    chai.expect(res.status).to.equal(404);
    chai.expect(res.body.customCode).to.equal("unsupported_chain");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");

    // Restore chain
    chainMap[unknownChainId] = chainToRestore;
  });

  it("should return a 400 when the address is invalid", async function () {
    const res = await chai
      .request(serverFixture.server.app)
      .get(`/v2/contracts/${chainFixture.chainId}/0xabc`);

    chai.expect(res.status).to.equal(400);
    chai.expect(res.body.customCode).to.equal("invalid_parameter");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");
  });

  it("should return a 404 when the contract is not verified", async function () {
    const res = await chai
      .request(serverFixture.server.app)
      .get(
        `/v2/contracts/${chainFixture.chainId}/0x0000000000000000000000000000000000000000`,
      );

    chai.expect(res.status).to.equal(404);
    chai.expect(res.body.customCode).to.equal("not_verified");
    chai.expect(res.body).to.have.property("errorId");
    chai.expect(res.body).to.have.property("message");
  });
});
