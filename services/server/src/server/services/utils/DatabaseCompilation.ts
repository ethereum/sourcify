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
import { PoolClient } from "pg";
import { bytesFromString } from "./database-util";

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
    public poolClient: PoolClient,
    public address: string,
    public chainId: number,
    public transactionHash: string,
  ) {}

  async extractCompilationProperties() {
    try {
      // Fetch compilation data from the database
      const verifiedContractResult = await this.poolClient.query(
        `SELECT 
            verified_contracts.*,
            sourcify_matches.metadata,
            compiled_contracts.compiler,
            compiled_contracts.version,
            compiled_contracts.language,
            compiled_contracts.name,
            compiled_contracts.fully_qualified_name,
            compiled_contracts.compiler_settings,
            compiled_contracts.compilation_artifacts,
            compiled_contracts.creation_code_artifacts,
            compiled_contracts.runtime_code_artifacts,
            compiled_creation_code.code as compiled_creation_code,
            compiled_runtime_code.code as compiled_runtime_code
          FROM verified_contracts
          JOIN compiled_contracts ON compiled_contracts.id = verified_contracts.compilation_id
          JOIN sourcify_matches ON sourcify_matches.verified_contract_id = verified_contracts.id
          JOIN code compiled_creation_code ON compiled_contracts.creation_code_hash = compiled_creation_code.code_hash 
          JOIN code compiled_runtime_code ON compiled_contracts.runtime_code_hash = compiled_runtime_code.code_hash
          JOIN contract_deployments ON contract_deployments.id = verified_contracts.deployment_id
          WHERE 1=1
          AND contract_deployments.chain_id = $1
          AND contract_deployments.address = $2
          AND contract_deployments.transaction_hash = $3`,
        [
          this.chainId,
          bytesFromString(this.address),
          bytesFromString(this.transactionHash),
        ],
      );

      if (verifiedContractResult.rows.length === 0) {
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
      const sourcesResult = await this.poolClient.query(
        `SELECT 
            sources.content,
            compiled_contracts_sources.path
          FROM compiled_contracts_sources
          JOIN sources ON sources.source_hash = compiled_contracts_sources.source_hash
          WHERE compiled_contracts_sources.compilation_id = $1`,
        [verifiedContract.compilation_id],
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
        language: "Solidity",
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
                  object:
                    verifiedContract.compiled_creation_code.toString("hex"),
                  sourceMap: verifiedContract.creation_code_artifacts.sourceMap,
                  linkReferences:
                    verifiedContract.creation_code_artifacts.linkReferences,
                  opcodes: verifiedContract.creation_code_artifacts.opcodes,
                },
                deployedBytecode: {
                  object:
                    verifiedContract.compiled_runtime_code.toString("hex"),
                  sourceMap: verifiedContract.runtime_code_artifacts.sourceMap,
                  linkReferences:
                    verifiedContract.runtime_code_artifacts.linkReferences,
                  immutableReferences:
                    verifiedContract.runtime_code_artifacts.immutableReferences,
                  opcodes: verifiedContract.runtime_code_artifacts.opcodes,
                },
                methodIdentifiers:
                  verifiedContract.compilation_artifacts.methodIdentifiers,
              },
            },
          },
        },
      };
    } catch (error) {
      console.error(error);
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
