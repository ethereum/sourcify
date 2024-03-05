const { deployFromAbiAndBytecodeForCreatorTxHash } = require("./helpers");
const { id: keccak256str } = require("ethers");

function toHexString(byteArray) {
  return Array.from(byteArray, function (byte) {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
}

const verifierAllianceTest = async (
  server,
  chai,
  storageService,
  localSigner,
  defaultContractChain,
  testCase,
  { deployWithConstructorArguments } = { deployWithConstructorArguments: false }
) => {
  let address;
  let txHash;
  if (!deployWithConstructorArguments) {
    const { contractAddress, txHash: txCreationHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        localSigner,
        testCase.compilation_artifacts.abi,
        testCase.deployed_creation_code
      );
    address = contractAddress;
    txHash = txCreationHash;
  } else {
    const { contractAddress, txHash: txCreationHash } =
      await deployFromAbiAndBytecodeForCreatorTxHash(
        localSigner,
        testCase.compilation_artifacts.abi,
        testCase.compiled_creation_code,
        [testCase.creation_values.constructorArguments]
      );
    address = contractAddress;
    txHash = txCreationHash;
  }

  const compilationTarget = {};
  const fullyQualifiedName = testCase.fully_qualified_name.split(":");
  compilationTarget[fullyQualifiedName[0]] = fullyQualifiedName[1];
  const sources = {};
  Object.keys(testCase.sources).forEach((path) => {
    sources[path] = {
      content: testCase.sources[path],
      keccak256: keccak256str(testCase.sources[path]),
      urls: [],
    };
  });
  await chai
    .request(server.app)
    .post("/")
    .send({
      address: address,
      chain: defaultContractChain,
      creatorTxHash: txHash,
      files: {
        "metadata.json": JSON.stringify({
          compiler: {
            version: testCase.version,
          },
          language: "Solidity",
          output: {
            abi: [],
            devdoc: {},
            userdoc: {},
          },
          settings: {
            ...testCase.compiler_settings,
            compilationTarget,
          },
          sources,
          version: 1,
        }),
        ...testCase.sources,
      },
    });
  await storageService.sourcifyDatabase.init();
  const res = await storageService.sourcifyDatabase.databasePool.query(
    `SELECT 
        compilation_artifacts,
        creation_code_artifacts,
        runtime_code_artifacts,
        creation_match,
        creation_values,
        creation_transformations,
        runtime_match,
        runtime_values,
        runtime_transformations,
        compiled_runtime_code.code as compiled_runtime_code,
        compiled_creation_code.code as compiled_creation_code
      FROM verified_contracts vc
      LEFT JOIN contract_deployments cd ON cd.id = vc.deployment_id
      LEFT JOIN compiled_contracts cc ON cc.id = vc.compilation_id 
      LEFT JOIN code compiled_runtime_code ON compiled_runtime_code.code_hash = cc.runtime_code_hash
      LEFT JOIN code compiled_creation_code ON compiled_creation_code.code_hash = cc.creation_code_hash
      where cd.address = $1`,
    [Buffer.from(address.substring(2), "hex")]
  );

  if (res.rowCount === 1) {
    chai
      .expect(res.rows[0].compilation_artifacts)
      .to.deep.equal(testCase.compilation_artifacts);
    chai
      .expect(`0x${toHexString(res.rows[0].compiled_runtime_code)}`)
      .to.equal(testCase.compiled_runtime_code);
    chai
      .expect(res.rows[0].runtime_code_artifacts)
      .to.deep.equal(testCase.runtime_code_artifacts);
    chai
      .expect(res.rows[0].runtime_match)
      .to.deep.equal(testCase.runtime_match);
    chai
      .expect(res.rows[0].runtime_values)
      .to.deep.equal(testCase.runtime_values);
    chai
      .expect(res.rows[0].runtime_transformations)
      .to.deep.equal(testCase.runtime_transformations);

    // For now disable the creation tests
    chai
      .expect(`0x${toHexString(res.rows[0].compiled_creation_code)}`)
      .to.equal(testCase.compiled_creation_code);
    chai
      .expect(res.rows[0].creation_code_artifacts)
      .to.deep.equal(testCase.creation_code_artifacts);
    chai
      .expect(res.rows[0].creation_match)
      .to.deep.equal(testCase.creation_match);
    chai
      .expect(res.rows[0].creation_values)
      .to.deep.equal(testCase.creation_values);
    chai
      .expect(res.rows[0].creation_transformations)
      .to.deep.equal(testCase.creation_transformations);
  }
};
module.exports = {
  verifierAllianceTest,
};
