interface SchemaField {
  name: string;
  type: string;
  nullable?: boolean;
}

interface CreateTableRequest {
  namespace: string;
  table_name: string;
  schema: SchemaField[];
}

async function createCodeTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating code table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_code",
      schema: [
        {
          name: "code_hash",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "code",
          type: "varbinary",
          nullable: true,
        },
        {
          name: "code_hash_keccak",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "updated_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "created_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "updated_by",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Code table created successfully");
}

async function createCompiledContractsTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating compiled_contracts table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_compiled_contracts",
      schema: [
        {
          name: "id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "updated_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "created_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "updated_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "compiler",
          type: "varchar",
          nullable: false,
        },
        {
          name: "version",
          type: "varchar",
          nullable: false,
        },
        {
          name: "language",
          type: "varchar",
          nullable: false,
        },
        {
          name: "name",
          type: "varchar",
          nullable: false,
        },
        {
          name: "fully_qualified_name",
          type: "varchar",
          nullable: false,
        },
        {
          name: "sources",
          type: "varchar",
          nullable: true,
        },
        {
          name: "compiler_settings",
          type: "varchar",
          nullable: false,
        },
        {
          name: "compilation_artifacts",
          type: "varchar",
          nullable: false,
        },
        {
          name: "creation_code_hash",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "creation_code_artifacts",
          type: "varchar",
          nullable: false,
        },
        {
          name: "runtime_code_hash",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "runtime_code_artifacts",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Compiled contracts table created successfully");
}

async function createCompiledContractsSourcesTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating compiled_contracts_sources table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_compiled_contracts_sources",
      schema: [
        {
          name: "id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "compilation_id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "source_hash",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "path",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Compiled contracts sources table created successfully");
}

async function createContractDeploymentsTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating contract_deployments table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_contract_deployments",
      schema: [
        {
          name: "id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "chain_id",
          type: "double",
          nullable: false,
        },
        {
          name: "address",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "transaction_hash",
          type: "varbinary",
          nullable: true,
        },
        {
          name: "block_number",
          type: "double",
          nullable: true,
        },
        {
          name: "transaction_index",
          type: "double",
          nullable: true,
        },
        {
          name: "deployer",
          type: "varbinary",
          nullable: true,
        },
        {
          name: "contract_id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "updated_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "created_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "updated_by",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Contract deployments table created successfully");
}

async function createContractsTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating contracts table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_contracts",
      schema: [
        {
          name: "id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "creation_code_hash",
          type: "varbinary",
          nullable: true,
        },
        {
          name: "runtime_code_hash",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "updated_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "created_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "updated_by",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Contracts table created successfully");
}

async function createSourcesTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating sources table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_sources",
      schema: [
        {
          name: "source_hash",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "source_hash_keccak",
          type: "varbinary",
          nullable: false,
        },
        {
          name: "content",
          type: "varchar",
          nullable: false,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "updated_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "created_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "updated_by",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Sources table created successfully");
}

async function createSourcifyMatchesTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating sourcify_matches table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_matches",
      schema: [
        {
          name: "id",
          type: "integer",
          nullable: false,
        },
        {
          name: "verified_contract_id",
          type: "integer",
          nullable: false,
        },
        {
          name: "creation_match",
          type: "varchar",
          nullable: true,
        },
        {
          name: "runtime_match",
          type: "varchar",
          nullable: true,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "metadata",
          type: "varchar",
          nullable: false,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Sourcify matches table created successfully");
}

async function createVerifiedContractsTable(
  baseUrl: string,
  headers: Record<string, string>,
) {
  console.log("Creating verified_contracts table...");
  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      namespace: "test_sourcify",
      table_name: "sourcify_verified_contracts",
      schema: [
        {
          name: "id",
          type: "integer",
          nullable: false,
        },
        {
          name: "created_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "updated_at",
          type: "timestamp",
          nullable: false,
        },
        {
          name: "created_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "updated_by",
          type: "varchar",
          nullable: false,
        },
        {
          name: "deployment_id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "compilation_id",
          type: "varchar",
          nullable: false,
        },
        {
          name: "creation_match",
          type: "boolean",
          nullable: false,
        },
        {
          name: "creation_values",
          type: "varchar",
          nullable: true,
        },
        {
          name: "creation_transformations",
          type: "varchar",
          nullable: true,
        },
        {
          name: "runtime_match",
          type: "boolean",
          nullable: false,
        },
        {
          name: "runtime_values",
          type: "varchar",
          nullable: true,
        },
        {
          name: "runtime_transformations",
          type: "varchar",
          nullable: true,
        },
        {
          name: "runtime_metadata_match",
          type: "boolean",
          nullable: true,
        },
        {
          name: "creation_metadata_match",
          type: "boolean",
          nullable: true,
        },
      ],
    } as CreateTableRequest),
  });
  console.log("Verified contracts table created successfully");
}

async function createTables(apiKey: string): Promise<void> {
  console.log("Starting table creation process...");
  const baseUrl = "https://api.dune.com/api/v1/table";
  const headers = {
    "x-dune-api-key": apiKey,
    "Content-Type": "application/json",
  };

  try {
    await createCodeTable(baseUrl, headers);
    await createCompiledContractsTable(baseUrl, headers);
    await createCompiledContractsSourcesTable(baseUrl, headers);
    await createContractDeploymentsTable(baseUrl, headers);
    await createContractsTable(baseUrl, headers);
    await createSourcesTable(baseUrl, headers);
    await createSourcifyMatchesTable(baseUrl, headers);
    await createVerifiedContractsTable(baseUrl, headers);
    console.log("All tables created successfully!");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
}

export { createTables };
