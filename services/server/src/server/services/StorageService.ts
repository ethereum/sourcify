import { Match, CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import {
  IpfsRepositoryService,
  IpfsRepositoryServiceOptions,
} from "./storageServices/IpfsRepositoryService";
import {
  SourcifyDatabaseService,
  SourcifyDatabaseServiceOptions,
} from "./storageServices/SourcifyDatabaseService";
import {
  AllianceDatabaseService,
  AllianceDatabaseServiceOptions,
} from "./storageServices/AllianceDatabaseService";
import { logger } from "../../common/logger";

export interface IStorageService {
  init(): Promise<boolean>;
  storeMatch(contract: CheckedContract, match: Match): Promise<void | Match>;
  checkByChainAndAddress?(address: string, chainId: string): Promise<Match[]>;
  checkAllByChainAndAddress?(
    address: string,
    chainId: string
  ): Promise<Match[]>;
}

interface StorageServiceOptions {
  ipfsRepositoryServiceOptions: IpfsRepositoryServiceOptions;
  sourcifyDatabaseServiceOptions?: SourcifyDatabaseServiceOptions;
  allianceDatabaseServiceOptions?: AllianceDatabaseServiceOptions;
}

export class StorageService {
  ipfsRepository: IpfsRepositoryService;
  sourcifyDatabase?: SourcifyDatabaseService;
  allianceDatabase?: AllianceDatabaseService;

  constructor(options: StorageServiceOptions) {
    this.ipfsRepository = new IpfsRepositoryService(
      options.ipfsRepositoryServiceOptions
    );
    if (options.sourcifyDatabaseServiceOptions?.postgres) {
      this.sourcifyDatabase = new SourcifyDatabaseService(
        options.sourcifyDatabaseServiceOptions
      );
    }
    if (
      options.allianceDatabaseServiceOptions?.googleCloudSql ||
      options.allianceDatabaseServiceOptions?.postgres
    ) {
      this.allianceDatabase = new AllianceDatabaseService(
        options.allianceDatabaseServiceOptions
      );
    }
  }

  async init() {
    try {
      await this.ipfsRepository?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize ipfsRepository: " + e.message);
    }
    try {
      await this.sourcifyDatabase?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize allianceDatabase: " + e.message);
    }
    try {
      await this.allianceDatabase?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize allianceDatabase: " + e.message);
    }
    return true;
  }

  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return (
      (await this.sourcifyDatabase?.checkByChainAndAddress?.(
        address,
        chainId
      )) || []
    );
  }

  storeMatch(contract: CheckedContract, match: Match) {
    logger.info(
      `Storing ${contract.name} address=${match.address} chainId=${match.chainId} match runtimeMatch=${match.runtimeMatch} creationMatch=${match.creationMatch}`
    );
    try {
      this.allianceDatabase?.storeMatch(contract, match);
    } catch (e) {
      logger.warn("Error while storing on the AllianceDatabase: ", e);
    }
    this.ipfsRepository.storeMatch(contract, match);
    return this.sourcifyDatabase?.storeMatch(contract, match);
  }
}
