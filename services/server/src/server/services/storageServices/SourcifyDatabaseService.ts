import {
  Match,
  CheckedContract,
  Status,
} from "@ethereum-sourcify/lib-sourcify";
import { logger } from "../../../common/logger";
import * as Database from "../utils/database-util";
import { Pool } from "pg";
import AbstractDatabaseService from "./AbstractDatabaseService";
import { IStorageService } from "../StorageService";

export interface SourcifyDatabaseServiceOptions {
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export class SourcifyDatabaseService
  extends AbstractDatabaseService
  implements IStorageService
{
  databaseName = "SourcifyDatabase";
  databasePool!: Pool;

  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(options: SourcifyDatabaseServiceOptions) {
    super();
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

    if (this.postgresHost) {
      this.databasePool = new Pool({
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        password: this.postgresPassword,
        max: 5,
      });
    } else {
      throw new Error(`${this.databaseName} is disabled`);
    }
    logger.info(`${this.databaseName} is active`);
    return true;
  }

  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    await this.init();

    const existingVerifiedContractResult =
      await Database.getSourcifyMatchByChainAddress(
        this.databasePool,
        parseInt(chainId),
        address
      );

    if (existingVerifiedContractResult.rowCount === 0) {
      return [];
    }
    return [
      {
        address,
        chainId,
        runtimeMatch: existingVerifiedContractResult.rows[0]
          .runtime_match as Status,
        creationMatch: existingVerifiedContractResult.rows[0]
          .creation_match as Status,
        storageTimestamp: existingVerifiedContractResult.rows[0]
          .created_at as Date,
      },
    ];
  }

  // Override this method to include the SourcifyMatch
  async storeMatch(recompiledContract: CheckedContract, match: Match) {
    this.validateBeforeStoring(recompiledContract, match);
    await this.init();

    const databaseColumns = await this.getDatabaseColumns(
      recompiledContract,
      match
    );

    // Get all the verified contracts existing in the Database for these exact onchain bytecodes.
    const existingVerifiedContractResult =
      await Database.getVerifiedContractByBytecodeHashes(
        this.databasePool,
        databaseColumns.keccak256OnchainRuntimeBytecode,
        databaseColumns.keccak256OnchainCreationBytecode
      );

    if (existingVerifiedContractResult.rowCount === 0) {
      const verifiedContractId = await this.insertNewVerifiedContract(
        recompiledContract,
        match,
        databaseColumns
      );
      await Database.insertSourcifyMatch(this.databasePool, {
        verifiedContractId: verifiedContractId,
        creationMatch: match.creationMatch,
        runtimeMatch: match.runtimeMatch,
      });
    } else {
      const verifiedContractId =
        // Right now we are not updating, we are inserting every time a new verified contract
        await await this.updateExistingVerifiedContract(
          existingVerifiedContractResult,
          recompiledContract,
          match,
          databaseColumns
        );
      if (verifiedContractId) {
        await Database.updateSourcifyMatch(this.databasePool, {
          verifiedContractId: verifiedContractId,
          creationMatch: match.creationMatch,
          runtimeMatch: match.runtimeMatch,
        });
      }
    }
  }
}
