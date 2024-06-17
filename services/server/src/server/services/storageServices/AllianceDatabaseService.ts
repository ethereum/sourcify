import logger from "../../../common/logger";
import { AuthTypes, Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";
import AbstractDatabaseService from "./AbstractDatabaseService";
import { IStorageService, StorageService } from "../StorageService";
import { CheckedContract, Match } from "@ethereum-sourcify/lib-sourcify";
import {
  FilesInfo,
  FileObject,
  ContractData,
  PaginatedContractData,
} from "../../types";
import { StorageIdentifiers } from "./identifiers";

export interface AllianceDatabaseServiceOptions {
  googleCloudSql?: {
    instanceName: string;
    iamAccount: string;
    database: string;
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export class AllianceDatabaseService
  extends AbstractDatabaseService
  implements IStorageService
{
  storageService: StorageService;
  IDENTIFIER = StorageIdentifiers.AllianceDatabase;
  databasePool!: Pool;

  googleCloudSqlInstanceName?: string;
  googleCloudSqlIamAccount?: string;
  googleCloudSqlDatabase?: string;
  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(
    storageService_: StorageService,
    options: AllianceDatabaseServiceOptions
  ) {
    super();
    this.storageService = storageService_;
    this.googleCloudSqlInstanceName = options.googleCloudSql?.instanceName;
    this.googleCloudSqlIamAccount = options.googleCloudSql?.iamAccount;
    this.googleCloudSqlDatabase = options.googleCloudSql?.database;
    this.postgresHost = options.postgres?.host;
    this.postgresPort = options.postgres?.port;
    this.postgresDatabase = options.postgres?.database;
    this.postgresUser = options.postgres?.user;
    this.postgresPassword = options.postgres?.password;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getMetadata(..._: any): Promise<string | false> {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFile(..._: any): Promise<string | false> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getTree(..._: any): Promise<FilesInfo<string[]>> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getContent(..._: any): Promise<FilesInfo<FileObject[]>> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getContracts(..._: any): Promise<ContractData> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPaginatedContracts(..._: any): Promise<PaginatedContractData> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkByChainAndAddress?(..._: any): Promise<Match[]> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkAllByChainAndAddress?(..._: any): Promise<Match[]> {
    throw new Error("Method not implemented.");
  }

  async init() {
    return await this.initDatabasePool();
  }

  async initDatabasePool(): Promise<boolean> {
    // if the database is already initialized
    if (this.databasePool != undefined) {
      return true;
    }

    if (this.googleCloudSqlInstanceName) {
      const connector = new Connector();
      const clientOpts = await connector.getOptions({
        instanceConnectionName: this.googleCloudSqlInstanceName, // "verifier-alliance:europe-west3:test-verifier-alliance",
        authType: AuthTypes.IAM,
      });
      this.databasePool = new Pool({
        ...clientOpts,
        user: this.googleCloudSqlIamAccount, // "marco.castignoli@ethereum.org",
        database: this.googleCloudSqlDatabase, // "postgres",
        max: 5,
      });
    } else if (this.postgresHost) {
      this.databasePool = new Pool({
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        password: this.postgresPassword,
        max: 5,
      });
    } else {
      throw new Error("Alliance Database is disabled");
    }

    // Checking pool health before continuing
    try {
      await this.databasePool.query("SELECT 1;");
    } catch (error) {
      logger.error(`Cannot connect to ${this.IDENTIFIER}`, {
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        error,
      });
      throw new Error(`Cannot connect to ${this.IDENTIFIER}`);
    }

    logger.info(`${this.IDENTIFIER} initialized`, {
      host: this.postgresHost,
      port: this.postgresPort,
      database: this.postgresDatabase,
    });
    return true;
  }

  async storeMatch(recompiledContract: CheckedContract, match: Match) {
    if (!match.creationMatch) {
      logger.warn(`Can't store to AllianceDatabase without creationMatch`, {
        name: recompiledContract.name,
        address: match.address,
        chainId: match.chainId,
        runtimeMatch: match.runtimeMatch,
        creationMatch: match.creationMatch,
      });
      return;
    }
    await this.insertOrUpdateVerifiedContract(recompiledContract, match);
    logger.info("Stored to AllianceDatabase", {
      name: recompiledContract.name,
      address: match.address,
      chainId: match.chainId,
      runtimeMatch: match.runtimeMatch,
      creationMatch: match.creationMatch,
    });
  }
}
