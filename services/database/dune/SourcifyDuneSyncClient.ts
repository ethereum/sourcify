import DuneClient from "./DuneDataClient";
import DuneTableClient from "./DuneTableClient";
import { countTotalRows } from "./fetchRows";
import {
  fetchCode,
  fetchCompiledContracts,
  fetchCompiledContractsSources,
  fetchContractDeployments,
  fetchContracts,
  fetchSources,
  fetchSourcifyMatches,
  fetchVerifiedContracts,
} from "./fetchRows";
import {
  formatCode,
  formatCompiledContracts,
  formatCompiledContractsSources,
  formatContractDeployments,
  formatContracts,
  formatSources,
  formatSourcifyMatches,
  formatVerifiedContracts,
} from "./formatRows";

export class SourcifyDuneSyncClient {
  private duneTableClient: DuneTableClient;
  private duneDataClient: DuneClient;

  constructor(apiKey: string) {
    this.duneTableClient = new DuneTableClient(apiKey);
    this.duneDataClient = new DuneClient(apiKey);
  }

  private getTableFunctions(tableName: string): {
    createTableFunction: () => Promise<Response>;
    insertDataFunction: (data: any[]) => Promise<Response>;
    fetchDataFunction: (
      lastValue: any,
      pageSize: number,
    ) => Promise<any[] | null>;
    formatDataFunction: (data: any[]) => any[];
    paginationField: string;
  } {
    let createTableFunction;
    let insertDataFunction;
    let fetchDataFunction;
    let formatDataFunction;
    let paginationField;

    switch (tableName) {
      case "sourcify_matches":
        createTableFunction =
          this.duneTableClient.createSourcifyMatchesTable.bind(
            this.duneTableClient,
          );
        insertDataFunction = this.duneDataClient.insertSourcifyMatches.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchSourcifyMatches;
        formatDataFunction = formatSourcifyMatches;
        paginationField = "id";
        break;
      case "verified_contracts":
        createTableFunction =
          this.duneTableClient.createVerifiedContractsTable.bind(
            this.duneTableClient,
          );
        insertDataFunction = this.duneDataClient.insertVerifiedContracts.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchVerifiedContracts;
        formatDataFunction = formatVerifiedContracts;
        paginationField = "id";
        break;
      case "compiled_contracts":
        createTableFunction =
          this.duneTableClient.createCompiledContractsTable.bind(
            this.duneTableClient,
          );
        insertDataFunction = this.duneDataClient.insertCompiledContracts.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchCompiledContracts;
        formatDataFunction = formatCompiledContracts;
        paginationField = "id";
        break;
      case "compiled_contracts_sources":
        createTableFunction =
          this.duneTableClient.createCompiledContractsSourcesTable.bind(
            this.duneTableClient,
          );
        insertDataFunction =
          this.duneDataClient.insertCompiledContractsSources.bind(
            this.duneDataClient,
          );
        fetchDataFunction = fetchCompiledContractsSources;
        formatDataFunction = formatCompiledContractsSources;
        paginationField = "id";
        break;
      case "sources":
        createTableFunction = this.duneTableClient.createSourcesTable.bind(
          this.duneTableClient,
        );
        insertDataFunction = this.duneDataClient.insertSources.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchSources;
        formatDataFunction = formatSources;
        paginationField = "source_hash";
        break;
      case "contracts":
        createTableFunction = this.duneTableClient.createContractsTable.bind(
          this.duneTableClient,
        );
        insertDataFunction = this.duneDataClient.insertContracts.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchContracts;
        formatDataFunction = formatContracts;
        paginationField = "id";
        break;
      case "contract_deployments":
        createTableFunction =
          this.duneTableClient.createContractDeploymentsTable.bind(
            this.duneTableClient,
          );
        insertDataFunction = this.duneDataClient.insertContractDeployments.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchContractDeployments;
        formatDataFunction = formatContractDeployments;
        paginationField = "id";
        break;
      case "code":
        createTableFunction = this.duneTableClient.createCodeTable.bind(
          this.duneTableClient,
        );
        insertDataFunction = this.duneDataClient.insertCode.bind(
          this.duneDataClient,
        );
        fetchDataFunction = fetchCode;
        formatDataFunction = formatCode;
        paginationField = "code_hash";
        break;
      default:
        throw new Error(`Unknown table: ${tableName}`);
    }

    return {
      createTableFunction,
      insertDataFunction,
      fetchDataFunction,
      formatDataFunction,
      paginationField,
    };
  }

  private async syncTableData(tableName: string) {
    const {
      createTableFunction,
      insertDataFunction,
      fetchDataFunction,
      formatDataFunction,
      paginationField,
    } = this.getTableFunctions(tableName);

    console.log(`[${tableName}] Creating table`);
    const tableResponse = await createTableFunction();
    const response = await tableResponse.json();

    if (response.message === "Table already existed and matched the request") {
      console.log(`[${tableName}] Table already exists`);
    } else {
      console.log(`[${tableName}] Table created`);
    }

    const totalRows = await countTotalRows(tableName);
    if (!totalRows || totalRows === 0) {
      console.error(`[${tableName}] No rows found`);
      return;
    }
    console.log(`[${tableName}] Total rows to insert: ${totalRows}`);

    const pageSize = 250;
    let syncedResults = 0;
    let resultsCount = pageSize;
    let lastValue = undefined;

    while (resultsCount === pageSize) {
      const data = await fetchDataFunction(lastValue, pageSize);
      if (!data) {
        console.error(`[${tableName}] No data found`);
        return;
      }

      resultsCount = data.length;
      syncedResults += resultsCount;
      lastValue = data[data.length - 1][paginationField];

      const formattedData = formatDataFunction(data);

      const dataResponse = await insertDataFunction(formattedData);
      if (dataResponse.status !== 200) {
        switch (dataResponse.status) {
          case 402: {
            const minutesToSleep = 5;
            console.error(
              `[${tableName}] Api limit exceeded. Sleeping for ${minutesToSleep} minutes...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, minutesToSleep * 60 * 1000),
            );
            break;
          }
          default:
            console.error(
              `[${tableName}] Error inserting: ${dataResponse.status}`,
            );
            console.error(
              `[${tableName}] Error body: ${JSON.stringify(
                await dataResponse.json(),
              )}`,
            );
        }
      }

      const insertResponse = await dataResponse.json();
      console.log(
        `[${tableName}] Inserted on Dune: ${insertResponse.rows_written} rows.`,
      );

      const percentage = (syncedResults / totalRows) * 100;
      console.log(
        `[${tableName}] Progress: ${syncedResults}/${totalRows} (${percentage.toFixed(2)}%)`,
      );
    }
  }

  async syncAll() {
    await this.syncTableData("code");
    await this.syncTableData("compiled_contracts");
    await this.syncTableData("sources");
    await this.syncTableData("compiled_contracts_sources");
    await this.syncTableData("contracts");
    await this.syncTableData("contract_deployments");
    await this.syncTableData("verified_contracts");
    await this.syncTableData("sourcify_matches");
  }
}
