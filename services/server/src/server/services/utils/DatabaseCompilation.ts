import {
  CompiledContractCborAuxdata,
  ISolidityCompiler,
  IVyperCompiler,
  Metadata,
  PreRunCompilation,
  SolidityJsonInput,
  SolidityOutput,
  VyperJsonInput,
  VyperOutput,
} from "@ethereum-sourcify/lib-sourcify";
import { bytesFromString } from "./database-util";
import { Database } from "./Database";
import logger from "../../../common/logger";

export class DatabaseCompilation {
  public jsonInput?: SolidityJsonInput | VyperJsonInput;
  public jsonOutput?: SolidityOutput | VyperOutput;
  public language?: "solidity" | "vyper";
  public compilerVersion?: string;
  public compilationTarget?: {
    name: string;
    path: string;
  };
  public creationCodeCborAuxdata?: CompiledContractCborAuxdata;
  public runtimeCodeCborAuxdata?: CompiledContractCborAuxdata;

  constructor(
    public compiler: ISolidityCompiler | IVyperCompiler,
    public database: Database,
    public address: string,
    public chainId: number,
    public transactionHash: string,
  ) {
    if (!this.database.isPoolInitialized()) {
      logger.error("DatabaseCompilation: database pool not initialized");
      throw new Error("DatabaseCompilation: database pool not initialized");
    }
  }

  async extractCompilationProperties() {
    try {
      // Fetch compilation data from the database
      const verifiedContractResult =
        await this.database.getVerifiedContractFromDeployment(
          this.chainId,
          bytesFromString(this.address),
          bytesFromString(this.transactionHash),
        );

      if (verifiedContractResult.rows.length === 0) {
        logger.error("DatabaseCompilation: verified contract not found", {
          chainId: this.chainId,
          address: this.address,
          transactionHash: this.transactionHash,
        });
        throw new Error("Verified contract not found");
      }

      const verifiedContract = verifiedContractResult.rows[0];

      this.language = verifiedContract.language as "solidity" | "vyper";
      this.compilerVersion = verifiedContract.version;

      this.creationCodeCborAuxdata =
        verifiedContract.creation_code_artifacts.cborAuxdata;
      this.runtimeCodeCborAuxdata =
        verifiedContract.runtime_code_artifacts.cborAuxdata;

      // Fetch sources
      const sourcesResult = await this.database.getCompiledContractSources(
        verifiedContract.compilation_id,
      );

      // Create sources object from the query result
      const sources: Record<string, { content: string }> = {};
      for (const source of sourcesResult.rows) {
        sources[source.path] = { content: source.content };
      }

      // Create settings from compiler_settings JSON field
      const settings = verifiedContract.compiler_settings;

      // Initialize jsonInput with the required fields
      this.jsonInput = {
        language: this.language === "solidity" ? "Solidity" : "Vyper",
        sources: sources,
        settings: settings,
      };

      // Get the file path and contract name from fully_qualified_name
      const metadataCompilationTarget = (verifiedContract.metadata as Metadata)
        .settings.compilationTarget;
      this.compilationTarget = {
        name: Object.values(metadataCompilationTarget)[0],
        path: Object.keys(metadataCompilationTarget)[0],
      };

      this.jsonOutput = {
        sources: verifiedContract.compilation_artifacts.sources || {},
        contracts: {
          [this.compilationTarget.path]: {
            [this.compilationTarget.name]: {
              abi: verifiedContract.compilation_artifacts.abi,
              userdoc: verifiedContract.compilation_artifacts.userdoc,
              devdoc: verifiedContract.compilation_artifacts.devdoc,
              metadata: JSON.stringify(verifiedContract.metadata),
              storageLayout:
                verifiedContract.compilation_artifacts.storageLayout,
              ir: verifiedContract.compilation_artifacts.ir,
              evm: {
                bytecode: {
                  ...verifiedContract.creation_code_artifacts,
                  object:
                    verifiedContract.compiled_creation_code.toString("hex"),
                },
                deployedBytecode: {
                  ...verifiedContract.runtime_code_artifacts,
                  object:
                    verifiedContract.compiled_runtime_code.toString("hex"),
                },
                methodIdentifiers:
                  verifiedContract.compilation_artifacts.methodIdentifiers,
              },
            },
          },
        },
      };
    } catch (error) {
      logger.error(
        "DatabaseCompilation: error extracting compilation properties",
        {
          error: error,
          chainId: this.chainId,
          address: this.address,
          transactionHash: this.transactionHash,
        },
      );
      throw error;
    }
  }

  async createCompilation(): Promise<PreRunCompilation> {
    await this.extractCompilationProperties();

    if (
      !this.language ||
      !this.compilerVersion ||
      !this.jsonInput ||
      !this.jsonOutput ||
      !this.compilationTarget ||
      !this.creationCodeCborAuxdata ||
      !this.runtimeCodeCborAuxdata
    ) {
      logger.error("DatabaseCompilation: compilation properties not found", {
        chainId: this.chainId,
        address: this.address,
        transactionHash: this.transactionHash,
      });
      throw new Error("Compilation properties not found");
    }

    const compilation = new PreRunCompilation(
      this.compiler,
      this.language,
      this.compilerVersion,
      this.jsonInput,
      this.jsonOutput,
      this.compilationTarget,
      this.creationCodeCborAuxdata,
      this.runtimeCodeCborAuxdata,
    );
    return compilation;
  }
}
