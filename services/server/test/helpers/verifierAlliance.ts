import { deployFromAbiAndBytecodeForCreatorTxHash } from "./helpers";
import { JsonRpcSigner, keccak256, id as keccak256str } from "ethers";
import type { Server } from "../../src/server/server";
import type { StorageService } from "../../src/server/services/StorageService";
import chai from "chai";
import chaiHttp from "chai-http";
import type { MetadataSourceMap } from "@ethereum-sourcify/lib-sourcify";

chai.use(chaiHttp);

function toHexString(byteArray: number[]) {
  return Array.from(byteArray, function (byte) {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
}

export const verifierAllianceTest = async (
  server: Server,
  storageService: StorageService,
  localSigner: JsonRpcSigner,
  defaultContractChain: string,
  testCase: any,
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

  const compilationTarget: Record<string, string> = {};
  const fullyQualifiedName: string[] = testCase.fully_qualified_name.split(":");
  compilationTarget[fullyQualifiedName[0]] = fullyQualifiedName[1];
  const sources: MetadataSourceMap = {};
  Object.keys(testCase.sources).forEach((path) => {
    sources[path] = {
      content: testCase.sources[path],
      keccak256: keccak256str(testCase.sources[path]),
      urls: [],
    };
  });
  const metadataCompilerSettings = {
    ...testCase.compiler_settings,
    // Convert the libraries from the compiler_settings format to the metadata format
    libraries: Object.keys(testCase.compiler_settings.libraries || {}).reduce(
      (libraries: Record<string, string>, contractPath) => {
        Object.keys(testCase.compiler_settings.libraries[contractPath]).forEach(
          (contractName) => {
            libraries[`${contractPath}:${contractName}`] =
              testCase.compiler_settings.libraries[contractPath][contractName];
          }
        );

        return libraries;
      },
      {}
    ),
  };
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
            ...metadataCompilerSettings,
            compilationTarget,
          },
          sources,
          version: 1,
        }),
        ...testCase.sources,
      },
    });
  if (!storageService.sourcifyDatabase) {
    chai.assert.fail("No database on StorageService");
  }
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
        compiled_creation_code.code as compiled_creation_code,
        compiled_runtime_code.code_hash as compiled_runtime_code_hash,
        compiled_creation_code.code_hash as compiled_creation_code_hash,
        onchain_runtime_code.code as onchain_runtime_code,
        onchain_creation_code.code as onchain_creation_code,
        onchain_runtime_code.code_hash as onchain_runtime_code_hash,
        onchain_creation_code.code_hash as onchain_creation_code_hash
      FROM verified_contracts vc
      LEFT JOIN contract_deployments cd ON cd.id = vc.deployment_id
      LEFT JOIN contracts c ON c.id = cd.contract_id
      LEFT JOIN compiled_contracts cc ON cc.id = vc.compilation_id 
      LEFT JOIN code compiled_runtime_code ON compiled_runtime_code.code_hash = cc.runtime_code_hash
      LEFT JOIN code compiled_creation_code ON compiled_creation_code.code_hash = cc.creation_code_hash
      LEFT JOIN code onchain_runtime_code ON onchain_runtime_code.code_hash = c.runtime_code_hash
      LEFT JOIN code onchain_creation_code ON onchain_creation_code.code_hash = c.creation_code_hash
      where cd.address = $1`,
    [Buffer.from(address.substring(2), "hex")]
  );
  chai.expect(res.rowCount).to.equal(1);
  chai
    .expect(res.rows[0].compilation_artifacts)
    .to.deep.equal(testCase.compilation_artifacts);
  chai
    .expect(`0x${toHexString(res.rows[0].compiled_runtime_code)}`)
    .to.equal(testCase.compiled_runtime_code);
  chai
    .expect(`0x${toHexString(res.rows[0].compiled_runtime_code_hash)}`)
    .to.equal(keccak256(testCase.compiled_runtime_code));
  chai
    .expect(`0x${toHexString(res.rows[0].onchain_runtime_code_hash)}`)
    .to.equal(keccak256(testCase.deployed_runtime_code));
  chai
    .expect(`0x${toHexString(res.rows[0].onchain_runtime_code)}`)
    .to.equal(testCase.deployed_runtime_code);
  chai
    .expect(res.rows[0].runtime_code_artifacts)
    .to.deep.equal(testCase.runtime_code_artifacts);
  chai.expect(res.rows[0].runtime_match).to.deep.equal(testCase.runtime_match);
  chai
    .expect(res.rows[0].runtime_values)
    .to.deep.equal(testCase.runtime_values);
  chai
    .expect(res.rows[0].runtime_transformations)
    .to.deep.equal(testCase.runtime_transformations);

  // For now disable the creation tests
  chai
    .expect(`0x${toHexString(res.rows[0].compiled_creation_code_hash)}`)
    .to.equal(keccak256(testCase.compiled_creation_code));
  chai
    .expect(`0x${toHexString(res.rows[0].compiled_creation_code)}`)
    .to.equal(testCase.compiled_creation_code);
  chai
    .expect(`0x${toHexString(res.rows[0].onchain_creation_code_hash)}`)
    .to.equal(keccak256(testCase.deployed_creation_code));
  chai
    .expect(`0x${toHexString(res.rows[0].onchain_creation_code)}`)
    .to.equal(testCase.deployed_creation_code);
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
};
