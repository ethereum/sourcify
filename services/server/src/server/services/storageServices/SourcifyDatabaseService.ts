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
import { bytesFromString } from "../utils/database-util";

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
    chainId: string,
    onlyPerfectMatches: boolean = false
  ): Promise<Match[]> {
    await this.init();

    const existingVerifiedContractResult =
      await Database.getSourcifyMatchByChainAddress(
        this.databasePool,
        parseInt(chainId),
        bytesFromString(address)!,
        onlyPerfectMatches
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

  validateBeforeStoring(
    recompiledContract: CheckedContract,
    match: Match
  ): boolean {
    // Prevent storing matches only if they don't have both onchainRuntimeBytecode and onchainCreationBytecode
    if (
      match.onchainRuntimeBytecode === undefined &&
      match.onchainCreationBytecode === undefined
    ) {
      throw new Error(
        `can only store contracts with at least runtimeBytecode or creationBytecode address=${match.address} chainId=${match.chainId}`
      );
    }
    return true;
  }

  // Override this method to include the SourcifyMatch
  async storeMatch(recompiledContract: CheckedContract, match: Match) {
    const { type, verifiedContractId } =
      await super.insertOrUpdateVerifiedContract(recompiledContract, match);

    if (!verifiedContractId) {
      throw new Error(
        "VerifiedContractId undefined before inserting sourcify match"
      );
    }
    if (type === "insert") {
      await Database.insertSourcifyMatch(this.databasePool, {
        verified_contract_id: verifiedContractId,
        creation_match: match.creationMatch,
        runtime_match: match.runtimeMatch,
      });
      logger.info(
        `Stored ${recompiledContract.name} to SourcifyDatabase address=${match.address} chainId=${match.chainId} match runtimeMatch=${match.runtimeMatch} creationMatch=${match.creationMatch}`
      );
    } else if (type === "update") {
      await Database.updateSourcifyMatch(this.databasePool, {
        verified_contract_id: verifiedContractId,
        creation_match: match.creationMatch,
        runtime_match: match.runtimeMatch,
      });
      logger.info(
        `Updated ${recompiledContract.name} to SourcifyDatabase address=${match.address} chainId=${match.chainId} match runtimeMatch=${match.runtimeMatch} creationMatch=${match.creationMatch}`
      );
    } else {
      throw new Error();
    }
  }
}
