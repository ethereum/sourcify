import { Match, CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import { logger } from "../../common/loggerLoki";
import {
  IpfsRepositoryService,
  IpfsRepositoryServiceOptions,
} from "./storageServices/IpfsRepositoryService";
import {
  AllianceDatabaseService,
  AllianceDatabaseServiceOptions,
} from "./storageServices/AllianceDatabaseService";

export interface IStorageService {
  init(): Promise<boolean>;
  storeMatch(contract: CheckedContract, match: Match): Promise<void | Match>;
  checkByChainAndAddress?(address: string, chainId: string): Match[];
  checkAllByChainAndAddress?(address: string, chainId: string): Match[];
}

interface StorageServiceOptions {
  ipfsRepositoryServiceOptions: IpfsRepositoryServiceOptions;
  allianceDatabaseServiceOptions?: AllianceDatabaseServiceOptions;
}

export class StorageService {
  ipfsRepository: IpfsRepositoryService;
  allianceDatabase?: AllianceDatabaseService;

  constructor(options: StorageServiceOptions) {
    this.ipfsRepository = new IpfsRepositoryService(
      options.ipfsRepositoryServiceOptions
    );
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
      await this.allianceDatabase?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize allianceDatabase: " + e.message);
    }
    return true;
  }

  checkByChainAndAddress(address: string, chainId: string): Match[] {
    return this.ipfsRepository.checkByChainAndAddress(address, chainId);
  }

  storeMatch(contract: CheckedContract, match: Match) {
    // this.allianceDatabase?.storeMatch(contract, match);
    return this.ipfsRepository.storeMatch(contract, match);
  }
}
