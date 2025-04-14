import chai, { expect } from "chai";
import { sourcifyChainsMap } from "../../../src/sourcify-chains";
import nock from "nock";
import {
  INVALID_API_KEY_RESPONSE,
  MULTIPLE_CONTRACT_RESPONSE,
  RATE_LIMIT_REACHED_RESPONSE,
  SINGLE_CONTRACT_RESPONSE,
  STANDARD_JSON_CONTRACT_RESPONSE,
  UNVERIFIED_CONTRACT_RESPONSE,
  VYPER_SINGLE_CONTRACT_RESPONSE,
  VYPER_STANDARD_JSON_CONTRACT_RESPONSE,
  mockEtherscanApi,
} from "../../helpers/etherscanResponseMocks";
import {
  fetchCompilerInputFromEtherscan,
  getVyperCompilerVersion,
  processEtherscanSolidityContract,
  processEtherscanVyperContract,
} from "../../../src/server/services/utils/etherscan-util";
import {
  solc,
  vyperCompiler,
} from "@ethereum-sourcify/lib-sourcify/test/utils";
import chaiAsPromised from "chai-as-promised";
import {
  SolidityCompilation,
  VyperCompilation,
} from "@ethereum-sourcify/lib-sourcify";

chai.use(chaiAsPromised);

describe.only("etherscan util", function () {
  const testChainId = "1";
  const testAddress = "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2";

  this.afterEach(() => {
    nock.cleanAll();
  });

  describe("fetchCompilerInputFromEtherscan", () => {
    it("should throw when fetching a non verified contract from etherscan", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        UNVERIFIED_CONTRACT_RESPONSE,
      );

      await expect(
        fetchCompilerInputFromEtherscan(
          sourcifyChainsMap[testChainId],
          testAddress,
          undefined,
          true,
        ),
      ).to.eventually.be.rejected.and.have.nested.property(
        "payload.customCode",
        "not_etherscan_verified",
      );
    });

    it("should throw when an invalid api key is provided", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        INVALID_API_KEY_RESPONSE,
      );

      await expect(
        fetchCompilerInputFromEtherscan(
          sourcifyChainsMap[testChainId],
          testAddress,
          undefined,
          true,
        ),
      ).to.eventually.be.rejected.and.have.nested.property(
        "payload.customCode",
        "etherscan_request_failed",
      );
    });

    it("should throw when the rate limit is reached", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        RATE_LIMIT_REACHED_RESPONSE,
      );

      await expect(
        fetchCompilerInputFromEtherscan(
          sourcifyChainsMap[testChainId],
          testAddress,
          undefined,
          true,
        ),
      ).to.eventually.be.rejected.and.have.nested.property(
        "payload.customCode",
        "etherscan_limit",
      );
    });

    it("should process a single contract response from etherscan", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        SINGLE_CONTRACT_RESPONSE,
      );

      const result = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );
      expect(result.vyperResult).to.be.undefined;
      expect(result.solidityResult).to.deep.equal({
        compilerVersion:
          SINGLE_CONTRACT_RESPONSE.result[0].CompilerVersion.substring(1),
        solcJsonInput: {
          language: "Solidity",
          sources: {
            [SINGLE_CONTRACT_RESPONSE.result[0].ContractName + ".sol"]: {
              content: SINGLE_CONTRACT_RESPONSE.result[0].SourceCode,
            },
          },
          settings: {
            optimizer: {
              enabled:
                SINGLE_CONTRACT_RESPONSE.result[0].OptimizationUsed === "1",
              runs: parseInt(SINGLE_CONTRACT_RESPONSE.result[0].Runs),
            },
            outputSelection: {
              "*": {
                "*": ["metadata", "evm.deployedBytecode.object"],
              },
            },
            evmVersion:
              SINGLE_CONTRACT_RESPONSE.result[0].EVMVersion.toLowerCase() !==
              "default"
                ? SINGLE_CONTRACT_RESPONSE.result[0].EVMVersion
                : undefined,
            libraries: {},
          },
        },
        contractName: SINGLE_CONTRACT_RESPONSE.result[0].ContractName,
      });
    });

    it("should process a multiple contract response from etherscan", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        MULTIPLE_CONTRACT_RESPONSE,
      );

      const result = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );
      expect(result.vyperResult).to.be.undefined;
      expect(result.solidityResult).to.deep.equal({
        compilerVersion:
          MULTIPLE_CONTRACT_RESPONSE.result[0].CompilerVersion.substring(1),
        solcJsonInput: {
          language: "Solidity",
          sources: JSON.parse(MULTIPLE_CONTRACT_RESPONSE.result[0].SourceCode),
          settings: {
            optimizer: {
              enabled:
                MULTIPLE_CONTRACT_RESPONSE.result[0].OptimizationUsed === "1",
              runs: parseInt(MULTIPLE_CONTRACT_RESPONSE.result[0].Runs),
            },
            outputSelection: {
              "*": {
                "*": ["metadata", "evm.deployedBytecode.object"],
              },
            },
            evmVersion:
              MULTIPLE_CONTRACT_RESPONSE.result[0].EVMVersion.toLowerCase() !==
              "default"
                ? MULTIPLE_CONTRACT_RESPONSE.result[0].EVMVersion
                : undefined,
            libraries: {},
          },
        },
        contractName: MULTIPLE_CONTRACT_RESPONSE.result[0].ContractName,
      });
    });

    it("should process a standard json contract response from etherscan", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        STANDARD_JSON_CONTRACT_RESPONSE,
      );

      const result = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );
      expect(result.vyperResult).to.be.undefined;
      const expectedJsonInput = JSON.parse(
        STANDARD_JSON_CONTRACT_RESPONSE.result[0].SourceCode.substring(
          1,
          STANDARD_JSON_CONTRACT_RESPONSE.result[0].SourceCode.length - 1,
        ),
      );
      expectedJsonInput.settings.outputSelection["*"]["*"] = [
        "metadata",
        "evm.deployedBytecode.object",
      ];
      expect(result.solidityResult).to.deep.equal({
        compilerVersion:
          STANDARD_JSON_CONTRACT_RESPONSE.result[0].CompilerVersion.substring(
            1,
          ),
        solcJsonInput: expectedJsonInput,
        contractName: STANDARD_JSON_CONTRACT_RESPONSE.result[0].ContractName,
      });
    });

    it("should process a vyper single contract response from etherscan", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        VYPER_SINGLE_CONTRACT_RESPONSE,
      );

      const result = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );
      expect(result.solidityResult).to.be.undefined;
      const expectedName =
        VYPER_SINGLE_CONTRACT_RESPONSE.result[0].ContractName.replace(
          /\s+/g,
          "",
        )
          .replace(/\n/g, "")
          .replace(/\r/g, "");
      const expectedPath = `${expectedName}.vy`;
      expect(result.vyperResult).to.deep.equal({
        compilerVersion: await getVyperCompilerVersion(
          VYPER_SINGLE_CONTRACT_RESPONSE.result[0].CompilerVersion,
        ),
        vyperJsonInput: {
          language: "Vyper",
          sources: {
            [expectedPath]: {
              content:
                VYPER_SINGLE_CONTRACT_RESPONSE.result[0].SourceCode.replace(
                  /\r/g,
                  "",
                ),
            },
          },
          settings: {
            outputSelection: {
              "*": ["evm.deployedBytecode.object"],
            },
            evmVersion:
              VYPER_SINGLE_CONTRACT_RESPONSE.result[0].EVMVersion !== "Default"
                ? (VYPER_SINGLE_CONTRACT_RESPONSE.result[0].EVMVersion as any)
                : undefined,
            search_paths: ["."],
          },
        },
        contractName: expectedName,
        contractPath: expectedPath,
      });
    });

    it("should process a vyper standard json contract response from etherscan", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        VYPER_STANDARD_JSON_CONTRACT_RESPONSE,
      );

      const result = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );
      expect(result.solidityResult).to.be.undefined;
      const expectedJsonInput = JSON.parse(
        VYPER_STANDARD_JSON_CONTRACT_RESPONSE.result[0].SourceCode.substring(
          1,
          VYPER_STANDARD_JSON_CONTRACT_RESPONSE.result[0].SourceCode.length - 1,
        ),
      );
      delete expectedJsonInput.compiler_version;
      delete expectedJsonInput.integrity;
      const expectedPath = Object.keys(
        expectedJsonInput.settings.outputSelection,
      )[0];
      const expectedName = expectedPath.split("/").pop()!.split(".")[0];
      expect(result.vyperResult).to.deep.equal({
        compilerVersion: await getVyperCompilerVersion(
          VYPER_STANDARD_JSON_CONTRACT_RESPONSE.result[0].CompilerVersion,
        ),
        vyperJsonInput: expectedJsonInput,
        contractName: expectedName,
        contractPath: expectedPath,
      });
    });
  });

  describe("processEtherscanSolidityContract", () => {
    it("should return a SolidityCompilation", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        SINGLE_CONTRACT_RESPONSE,
      );
      const { solidityResult } = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );

      const compilation = await processEtherscanSolidityContract(
        solc,
        solidityResult!,
      );

      const expectedCompilation = new SolidityCompilation(
        solc,
        solidityResult!.compilerVersion,
        solidityResult!.solcJsonInput,
        {
          path: solidityResult!.contractName + ".sol",
          name: solidityResult!.contractName,
        },
      );
      expect(compilation).to.be.instanceOf(SolidityCompilation);
      expect(compilation.compiler).to.equal(solc);
      expect(compilation.compilerVersion).to.equal(
        expectedCompilation.compilerVersion,
      );
      expect(compilation.jsonInput).to.deep.equal(
        expectedCompilation.jsonInput,
      );
      expect(compilation.compilationTarget).to.deep.equal(
        expectedCompilation.compilationTarget,
      );
    });
  });

  describe("processEtherscanVyperContract", () => {
    it("should return a VyperCompilation", async () => {
      mockEtherscanApi(
        sourcifyChainsMap[testChainId],
        testAddress,
        VYPER_SINGLE_CONTRACT_RESPONSE,
      );
      const { vyperResult } = await fetchCompilerInputFromEtherscan(
        sourcifyChainsMap[testChainId],
        testAddress,
      );

      const compilation = await processEtherscanVyperContract(
        vyperCompiler,
        vyperResult!,
      );

      const expectedCompilation = new VyperCompilation(
        vyperCompiler,
        vyperResult!.compilerVersion,
        vyperResult!.vyperJsonInput,
        {
          path: vyperResult!.contractPath,
          name: vyperResult!.contractName,
        },
      );
      expect(compilation).to.be.instanceOf(VyperCompilation);
      expect(compilation.compiler).to.equal(vyperCompiler);
      expect(compilation.compilerVersion).to.equal(
        expectedCompilation.compilerVersion,
      );
      expect(compilation.jsonInput).to.deep.equal(
        expectedCompilation.jsonInput,
      );
      expect(compilation.compilationTarget).to.deep.equal(
        expectedCompilation.compilationTarget,
      );
    });
  });
});
