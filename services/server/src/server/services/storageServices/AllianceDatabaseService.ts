import { logger } from "../../../common/logger";
import { AuthTypes, Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";
import AbstractDatabaseService from "./AbstractDatabaseService";
import { IStorageService } from "../StorageService";

export interface AllianceDatabaseServiceOptions {
  googleCloudSql: {
    instanceName: string;
    iamAccount: string;
    database: string;
  };
  postgres: {
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
  databaseName = "AllianceDatabase";
  databasePool!: Pool;

  googleCloudSqlInstanceName?: string;
  googleCloudSqlIamAccount?: string;
  googleCloudSqlDatabase?: string;
  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(options: AllianceDatabaseServiceOptions) {
    super();
    this.googleCloudSqlInstanceName = options.googleCloudSql.instanceName;
    this.googleCloudSqlIamAccount = options.googleCloudSql.iamAccount;
    this.googleCloudSqlDatabase = options.googleCloudSql.database;
    this.postgresHost = options.postgres.host;
    this.postgresPort = options.postgres.port;
    this.postgresDatabase = options.postgres.database;
    this.postgresUser = options.postgres.user;
    this.postgresPassword = options.postgres.password;
  }

  async init(): Promise<boolean> {
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
    throw new Error("Alliance Database is active");
  }
}
