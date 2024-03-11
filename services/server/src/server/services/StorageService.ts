import { Match, CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import {
  RepositoryV1Service,
  RepositoryV1ServiceOptions,
} from "./storageServices/RepositoryV1Service";
import {
  RepositoryV2Service,
  RepositoryV2ServiceOptions,
} from "./storageServices/RepositoryV2Service";
import {
  SourcifyDatabaseService,
  SourcifyDatabaseServiceOptions,
} from "./storageServices/SourcifyDatabaseService";
import {
  AllianceDatabaseService,
  AllianceDatabaseServiceOptions,
} from "./storageServices/AllianceDatabaseService";
import logger from "../../common/logger";

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
  repositoryV1ServiceOptions: RepositoryV1ServiceOptions;
  repositoryV2ServiceOptions: RepositoryV2ServiceOptions;
  sourcifyDatabaseServiceOptions?: SourcifyDatabaseServiceOptions;
  allianceDatabaseServiceOptions?: AllianceDatabaseServiceOptions;
}

export class StorageService {
  repositoryV1: RepositoryV1Service;
  repositoryV2?: RepositoryV2Service;
  sourcifyDatabase?: SourcifyDatabaseService;
  allianceDatabase?: AllianceDatabaseService;

  constructor(options: StorageServiceOptions) {
    this.repositoryV1 = new RepositoryV1Service(
      options.repositoryV1ServiceOptions
    );
    if (options.repositoryV2ServiceOptions?.repositoryPath) {
      this.repositoryV2 = new RepositoryV2Service(
        options.repositoryV2ServiceOptions
      );
    }
    if (
      options.sourcifyDatabaseServiceOptions?.postgres?.host &&
      options.sourcifyDatabaseServiceOptions?.postgres?.database &&
      options.sourcifyDatabaseServiceOptions?.postgres?.user &&
      options.sourcifyDatabaseServiceOptions?.postgres?.password
    ) {
      this.sourcifyDatabase = new SourcifyDatabaseService(
        options.sourcifyDatabaseServiceOptions
      );
    }
    if (
      options.allianceDatabaseServiceOptions?.googleCloudSql ||
      (options.allianceDatabaseServiceOptions?.postgres?.host &&
        options.allianceDatabaseServiceOptions?.postgres?.database &&
        options.allianceDatabaseServiceOptions?.postgres?.user &&
        options.allianceDatabaseServiceOptions?.postgres?.password)
    ) {
      this.allianceDatabase = new AllianceDatabaseService(
        options.allianceDatabaseServiceOptions
      );
    }
  }

  /* async init() {
    try {
      await this.repositoryV1?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize repositoryV1: " + e.message);
    }
    try {
      await this.repositoryV2?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize repositoryV2: " + e.message);
    }
    try {
      await this.sourcifyDatabase?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize sourcifyDatabase: " + e.message);
    }
    try {
      await this.allianceDatabase?.init();
    } catch (e: any) {
      throw new Error("Cannot initialize allianceDatabase: " + e.message);
    }
    return true;
  } */

  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return (
      (await this.repositoryV1?.checkByChainAndAddress?.(address, chainId)) ||
      []
    );
  }

  async checkAllByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return (
      (await this.repositoryV1?.checkAllByChainAndAddress?.(
        address,
        chainId
      )) || []
    );
  }

  async storeMatch(contract: CheckedContract, match: Match) {
    logger.info("Storing on StorageService", {
      name: contract.name,
      address: match.address,
      chainId: match.chainId,
      runtimeMatch: match.runtimeMatch,
      creationMatch: match.creationMatch,
    });

    // Initialize an array to hold active service promises
    const promises = [];

    // Conditionally push promises to the array based on service availability
    if (this.allianceDatabase) {
      promises.push(
        this.allianceDatabase.storeMatch(contract, match).catch((e) =>
          logger.warn("Error while storing on the AllianceDatabase: ", {
            error: e,
          })
        )
      );
    }

    if (this.sourcifyDatabase) {
      promises.push(
        this.sourcifyDatabase.storeMatch(contract, match).catch((e) =>
          logger.error("Error while storing on the SourcifyDatabase: ", {
            error: e,
          })
        )
      );
    }

    if (this.repositoryV2) {
      promises.push(
        this.repositoryV2.storeMatch(contract, match).catch((e) =>
          logger.error("Error while storing on the RepositoryV2: ", {
            error: e,
          })
        )
      );
    }

    // Always include repositoryV1
    promises.push(
      this.repositoryV1.storeMatch(contract, match).catch((e) => {
        logger.error("Error while storing on the RepositoryV1: ", { error: e });
        // For repositoryV1 we throw
        throw e;
      })
    );

    return await Promise.all(promises);
  }
}
