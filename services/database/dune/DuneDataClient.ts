export interface InsertData {
  code: Array<{
    code_hash: Buffer;
    code: Buffer | null;
    code_hash_keccak: Buffer;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  compiled_contracts: Array<{
    id: string;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
    compiler: string;
    version: string;
    language: string;
    name: string;
    fully_qualified_name: string;
    sources: any | null;
    compiler_settings: any;
    compilation_artifacts: any;
    creation_code_hash: Buffer;
    creation_code_artifacts: any;
    runtime_code_hash: Buffer;
    runtime_code_artifacts: any;
  }>;
  compiled_contracts_sources: Array<{
    id: string;
    compilation_id: string;
    source_hash: Buffer;
    path: string;
  }>;
  contract_deployments: Array<{
    id: string;
    chain_id: number;
    address: Buffer;
    transaction_hash: Buffer | null;
    block_number: number | null;
    transaction_index: number | null;
    deployer: Buffer | null;
    contract_id: string;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  contracts: Array<{
    id: string;
    creation_code_hash: Buffer | null;
    runtime_code_hash: Buffer;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  sources: Array<{
    source_hash: Buffer;
    source_hash_keccak: Buffer;
    content: string;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  sourcify_matches: Array<{
    id: number;
    verified_contract_id: number;
    creation_match: string | null;
    runtime_match: string | null;
    created_at: Date;
    metadata: any;
  }>;
  verified_contracts: Array<{
    id: number;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
    deployment_id: string;
    compilation_id: string;
    creation_match: boolean;
    creation_values: string | null;
    creation_transformations: string | null;
    runtime_match: boolean;
    runtime_values: string | null;
    runtime_transformations: string | null;
    runtime_metadata_match: boolean | null;
    creation_metadata_match: boolean | null;
  }>;
}

export default class DuneClient {
  private readonly baseUrl = "https://api.dune.com/api/v1/table";
  private readonly headers: { [key: string]: string };
  private readonly namespace = "sourcify_team";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required");
    }

    this.headers = {
      "x-dune-api-key": apiKey,
      "Content-Type": "application/x-ndjson",
    };
  }

  async insertCode(code: InsertData["code"]): Promise<void> {
    await fetch(`${this.baseUrl}/${this.namespace}/sourcify_code/insert`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(
        code.map((row) => ({
          ...row,
          code_hash: row.code_hash.toString("hex"),
          code: row.code?.toString("hex"),
          code_hash_keccak: row.code_hash_keccak.toString("hex"),
        })),
      ),
    });
  }

  async insertCompiledContracts(
    compiledContracts: InsertData["compiled_contracts"],
  ): Promise<void> {
    await fetch(`${this.baseUrl}/${this.namespace}/compiled_contracts/insert`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(
        compiledContracts.map((row) => ({
          ...row,
          sources: row.sources ? JSON.stringify(row.sources) : null,
          compiler_settings: JSON.stringify(row.compiler_settings),
          compilation_artifacts: JSON.stringify(row.compilation_artifacts),
          creation_code_hash: row.creation_code_hash.toString("hex"),
          creation_code_artifacts: JSON.stringify(row.creation_code_artifacts),
          runtime_code_hash: row.runtime_code_hash.toString("hex"),
          runtime_code_artifacts: JSON.stringify(row.runtime_code_artifacts),
        })),
      ),
    });
  }

  async insertCompiledContractsSources(
    compiledContractsSources: InsertData["compiled_contracts_sources"],
  ): Promise<void> {
    await fetch(
      `${this.baseUrl}/${this.namespace}/compiled_contracts_sources/insert`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(
          compiledContractsSources.map((row) => ({
            ...row,
            source_hash: row.source_hash.toString("hex"),
          })),
        ),
      },
    );
  }

  async insertContractDeployments(
    contractDeployments: InsertData["contract_deployments"],
  ): Promise<void> {
    await fetch(
      `${this.baseUrl}/${this.namespace}/contract_deployments/insert`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(
          contractDeployments.map((row) => ({
            ...row,
            address: row.address.toString("hex"),
            transaction_hash: row.transaction_hash?.toString("hex"),
            deployer: row.deployer?.toString("hex"),
          })),
        ),
      },
    );
  }

  async insertContracts(contracts: InsertData["contracts"]): Promise<void> {
    await fetch(`${this.baseUrl}/${this.namespace}/contracts/insert`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(
        contracts.map((row) => ({
          ...row,
          creation_code_hash: row.creation_code_hash?.toString("hex"),
          runtime_code_hash: row.runtime_code_hash.toString("hex"),
        })),
      ),
    });
  }

  async insertSources(sources: InsertData["sources"]): Promise<void> {
    await fetch(`${this.baseUrl}/${this.namespace}/sources/insert`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(
        sources.map((row) => ({
          ...row,
          source_hash: row.source_hash.toString("hex"),
          source_hash_keccak: row.source_hash_keccak.toString("hex"),
        })),
      ),
    });
  }

  async insertSourcifyMatches(
    sourcifyMatches: InsertData["sourcify_matches"],
  ): Promise<void> {
    await fetch(`${this.baseUrl}/${this.namespace}/sourcify_matches/insert`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(
        sourcifyMatches.map((row) => ({
          ...row,
          metadata: JSON.stringify(row.metadata),
        })),
      ),
    });
  }

  async insertVerifiedContracts(
    verifiedContracts: InsertData["verified_contracts"],
  ): Promise<Response> {
    return fetch(
      `${this.baseUrl}/${this.namespace}/verified_contracts/insert`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(verifiedContracts),
      },
    );
  }

  // async insertData(data: InsertData): Promise<void> {
  //   await Promise.all([
  //     this.insertCode(data.code),
  //     this.insertCompiledContracts(data.compiled_contracts),
  //     this.insertCompiledContractsSources(data.compiled_contracts_sources),
  //     this.insertContractDeployments(data.contract_deployments),
  //     this.insertContracts(data.contracts),
  //     this.insertSources(data.sources),
  //     this.insertSourcifyMatches(data.sourcify_matches),
  //     this.insertVerifiedContracts(data.verified_contracts),
  //   ]);
  // }
}
