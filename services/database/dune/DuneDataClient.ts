export interface InsertData {
  code: Array<{
    code_hash: string;
    code: string | null;
    code_hash_keccak: string;
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
    compiler_settings: any;
    compilation_artifacts: any;
    creation_code_hash: string;
    creation_code_artifacts: any;
    runtime_code_hash: string;
    runtime_code_artifacts: any;
  }>;
  compiled_contracts_sources: Array<{
    id: string;
    compilation_id: string;
    source_hash: string;
    path: string;
  }>;
  contract_deployments: Array<{
    id: string;
    chain_id: string; // bigint
    address: string;
    transaction_hash: string | null;
    block_number: string | null; // bigint
    transaction_index: number | null;
    deployer: string | null;
    contract_id: string;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  contracts: Array<{
    id: string;
    creation_code_hash: string | null;
    runtime_code_hash: string;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  sources: Array<{
    source_hash: string;
    source_hash_keccak: string;
    content: string;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>;
  sourcify_matches: Array<{
    id: string; // bigint
    verified_contract_id: string; // bigint
    creation_match: string | null;
    runtime_match: string | null;
    created_at: Date;
    metadata: any;
  }>;
  verified_contracts: Array<{
    id: string; // bigint
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

  async insertCode(code: InsertData["code"]) {
    return this.prepareInsertRequest(code, "code");
  }

  async insertCompiledContracts(
    compiledContracts: InsertData["compiled_contracts"],
  ) {
    return this.prepareInsertRequest(compiledContracts, "compiled_contracts");
  }

  async insertCompiledContractsSources(
    compiledContractsSources: InsertData["compiled_contracts_sources"],
  ) {
    return this.prepareInsertRequest(
      compiledContractsSources,
      "compiled_contracts_sources",
    );
  }

  async insertContractDeployments(
    contractDeployments: InsertData["contract_deployments"],
  ) {
    return this.prepareInsertRequest(
      contractDeployments,
      "contract_deployments",
    );
  }

  async insertContracts(contracts: InsertData["contracts"]) {
    return this.prepareInsertRequest(contracts, "contracts");
  }

  async insertSources(sources: InsertData["sources"]) {
    return this.prepareInsertRequest(sources, "sources");
  }

  async insertSourcifyMatches(sourcifyMatches: InsertData["sourcify_matches"]) {
    return this.prepareInsertRequest(sourcifyMatches, "sourcify_matches");
  }

  async insertVerifiedContracts(
    verifiedContracts: InsertData["verified_contracts"],
  ): Promise<Response> {
    return this.prepareInsertRequest(verifiedContracts, "verified_contracts");
  }

  private prepareInsertRequest(data: any, tableName: string) {
    return fetch(
      `${this.baseUrl}/${this.namespace}/${tableName}/insert`,
      this.prepareRequestOptions(data),
    );
  }

  private prepareRequestOptions(data: any) {
    return {
      method: "POST",
      headers: this.headers,
      body: data.map((row: any) => JSON.stringify(row)).join("\n"), // Must send as newline delimited json (NDJSON)
    };
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
