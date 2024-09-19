import { Match, CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import {
  RepositoryV1Service,
  RepositoryV1ServiceOptions,
} from "./storageServices/RepositoryV1Service";
import {
  RepositoryV2Service,
  RepositoryV2ServiceOptions,
} from "./storageServices/RepositoryV2Service";
import { SourcifyDatabaseService } from "./storageServices/SourcifyDatabaseService";
import { AllianceDatabaseService } from "./storageServices/AllianceDatabaseService";
import logger from "../../common/logger";
import { getMatchStatus } from "../common";
import {
  ContractData,
  FileObject,
  FilesInfo,
  Mandatory,
  MatchLevel,
  MatchLevelWithoutAny,
  MethodArgs,
  MethodNames,
  PaginatedContractData,
} from "../types";
import {
  RWStorageIdentifiers,
  StorageIdentifiers,
  WStorageIdentifiers,
} from "./storageServices/identifiers";
import { DatabaseServiceOptions } from "./storageServices/AbstractDatabaseService";
import { ConflictError } from "../../common/errors/ConflictError";

export interface WStorageService {
  IDENTIFIER: StorageIdentifiers;
  init(): Promise<boolean>;
  storeMatch(contract: CheckedContract, match: Match): Promise<void | Match>;
}

export interface RWStorageService extends WStorageService {
  getFile(
    chainId: string,
    address: string,
    match: MatchLevelWithoutAny,
    path: string,
  ): Promise<string | false>;
  getTree(
    chainId: string,
    address: string,
    match: MatchLevel,
  ): Promise<FilesInfo<string[]>>;
  getContent(
    chainId: string,
    address: string,
    match: MatchLevel,
  ): Promise<FilesInfo<Array<FileObject>>>;
  getContracts(chainId: string): Promise<ContractData>;
  getPaginatedContracts?(
    chainId: string,
    match: MatchLevel,
    page: number,
    limit: number,
    descending: boolean,
  ): Promise<PaginatedContractData>;
  checkByChainAndAddress(address: string, chainId: string): Promise<Match[]>;
  checkAllByChainAndAddress(address: string, chainId: string): Promise<Match[]>;
}

export interface EnabledServices {
  read: RWStorageIdentifiers;
  writeOrWarn: StorageIdentifiers[];
  writeOrErr: StorageIdentifiers[];
}

export interface StorageServiceOptions {
  enabledServices: EnabledServices;
  repositoryV1ServiceOptions: RepositoryV1ServiceOptions;
  repositoryV2ServiceOptions: RepositoryV2ServiceOptions;
  sourcifyDatabaseServiceOptions?: DatabaseServiceOptions;
  allianceDatabaseServiceOptions?: DatabaseServiceOptions;
}

export class StorageService {
  enabledServices: EnabledServices;

  rwServices: { [key in RWStorageIdentifiers]: RWStorageService } = {} as {
    [key in RWStorageIdentifiers]: RWStorageService;
  };
  wServices: { [key in StorageIdentifiers]: WStorageService } = {} as {
    [key in StorageIdentifiers]: WStorageService;
  };

  constructor(options: StorageServiceOptions) {
    this.enabledServices = options.enabledServices;

    const enabledServicesArray = [
      this.enabledServices.read,
      ...this.enabledServices.writeOrWarn,
      ...this.enabledServices.writeOrErr,
    ];

    // repositoryV1
    if (enabledServicesArray.includes(RWStorageIdentifiers.RepositoryV1)) {
      if (options.repositoryV1ServiceOptions?.repositoryPath) {
        const repositoryV1 = new RepositoryV1Service(
          options.repositoryV1ServiceOptions,
        );
        this.rwServices[repositoryV1.IDENTIFIER] = repositoryV1;
      } else {
        logger.error(
          "RepositoryV1 enabled, but path not set",
          options.repositoryV2ServiceOptions,
        );
        throw new Error("RepositoryV1 enabled, but path not set");
      }
    }

    // repositoryV2
    if (enabledServicesArray.includes(WStorageIdentifiers.RepositoryV2)) {
      if (options.repositoryV2ServiceOptions?.repositoryPath) {
        const repositoryV2 = new RepositoryV2Service(
          options.repositoryV2ServiceOptions,
        );
        this.wServices[repositoryV2.IDENTIFIER] = repositoryV2;
      } else {
        logger.error(
          "RepositoryV2 enabled, but path not set",
          options.repositoryV2ServiceOptions,
        );
        throw new Error("RepositoryV2 enabled, but path not set");
      }
    }

    // SourcifyDatabase
    if (enabledServicesArray.includes(RWStorageIdentifiers.SourcifyDatabase)) {
      if (
        options.sourcifyDatabaseServiceOptions?.postgres?.host &&
        options.sourcifyDatabaseServiceOptions?.postgres?.database &&
        options.sourcifyDatabaseServiceOptions?.postgres?.user &&
        options.sourcifyDatabaseServiceOptions?.postgres?.password
      ) {
        const sourcifyDatabase = new SourcifyDatabaseService(
          this,
          options.sourcifyDatabaseServiceOptions,
          options.repositoryV1ServiceOptions.repositoryServerUrl,
        );
        this.rwServices[sourcifyDatabase.IDENTIFIER] = sourcifyDatabase;
      } else {
        logger.error(
          "SourcifyDatabase enabled, but options are not complete",
          options.sourcifyDatabaseServiceOptions,
        );
        throw new Error(
          "SourcifyDatabase enabled, but options are not complete",
        );
      }
    }

    // AllianceDatabase
    if (enabledServicesArray.includes(WStorageIdentifiers.AllianceDatabase)) {
      if (
        options.allianceDatabaseServiceOptions?.googleCloudSql ||
        (options.allianceDatabaseServiceOptions?.postgres?.host &&
          options.allianceDatabaseServiceOptions?.postgres?.database &&
          options.allianceDatabaseServiceOptions?.postgres?.user &&
          options.allianceDatabaseServiceOptions?.postgres?.password)
      ) {
        const allianceDatabase = new AllianceDatabaseService(
          options.allianceDatabaseServiceOptions,
        );
        this.wServices[allianceDatabase.IDENTIFIER] = allianceDatabase;
      } else {
        logger.error(
          "AllianceDatabase enabled, but options are not complete",
          options.allianceDatabaseServiceOptions,
        );
        throw new Error(
          "AllianceDatabase enabled, but options are not complete",
        );
      }
    }
  }

  getRWServiceByConfigKey(configKey: RWStorageIdentifiers): RWStorageService {
    return this.rwServices[configKey];
  }

  getWServiceByConfigKey(configKey: StorageIdentifiers): WStorageService {
    return { ...this.rwServices, ...this.wServices }[configKey];
  }

  getDefaultReadService(): RWStorageService {
    return this.getRWServiceByConfigKey(this.enabledServices.read);
  }

  getWriteOrWarnServices(): WStorageService[] {
    return this.enabledServices.writeOrWarn.map((serviceKey) =>
      this.getWServiceByConfigKey(serviceKey),
    );
  }

  getWriteOrErrServices(): WStorageService[] {
    return this.enabledServices.writeOrErr.map((serviceKey) =>
      this.getWServiceByConfigKey(serviceKey),
    );
  }

  async init() {
    // Initialized only the used storage services

    // Get list of used storage services
    const enabledServicesArray = [
      this.getDefaultReadService(),
      ...this.getWriteOrWarnServices(),
      ...this.getWriteOrErrServices(),
    ].filter((service) => service !== undefined) as WStorageService[];

    logger.debug("Initializing used storage services", {
      storageServices: enabledServicesArray.map(
        (service) => service.IDENTIFIER,
      ),
    });

    // Try to initialize used storage services
    for (const service of enabledServicesArray) {
      logger.debug(`Initializing storage service: ${service.IDENTIFIER}`);
      if (!(await service.init())) {
        throw new Error(
          "Cannot initialize default storage service: " + service.IDENTIFIER,
        );
      }
    }
  }

  async storeMatch(contract: CheckedContract, match: Match) {
    logger.info("Storing match on StorageService", {
      name: contract.name,
      address: match.address,
      chainId: match.chainId,
      runtimeMatch: match.runtimeMatch,
      creationMatch: match.creationMatch,
    });

    const existingMatch = await this.performServiceOperation(
      "checkAllByChainAndAddress",
      [match.address, match.chainId],
    );
    if (
      existingMatch.length > 0 &&
      getMatchStatus(existingMatch[0]) === "partial" &&
      getMatchStatus(match) === "partial"
    ) {
      logger.info("Partial match already exists", {
        chain: match.chainId,
        address: match.address,
      });
      throw new ConflictError(
        `The contract ${match.address} on chainId ${match.chainId} is already partially verified. The provided new source code also yielded a partial match and will not be stored unless it's a full match`,
      );
    }

    // Initialize an array to hold active service promises
    const promises: Promise<Match | void>[] = [];

    this.getWriteOrErrServices().forEach((service) =>
      promises.push(
        service.storeMatch(contract, match).catch((e) => {
          logger.error(`Error storing to ${service.IDENTIFIER}`, {
            error: e,
          });
          throw e;
        }),
      ),
    );

    this.getWriteOrWarnServices().forEach((service) => {
      if (service) {
        promises.push(
          service.storeMatch(contract, match).catch((e) => {
            logger.warn(`Error storing to ${service.IDENTIFIER}`, {
              error: e,
              contract,
              match,
            });
          }),
        );
      }
    });

    return await Promise.all(promises);
  }

  async performServiceOperation<
    T extends Mandatory<RWStorageService>, // Mandatory is used to allow optional functions like getPaginatedContracts
    K extends MethodNames<T>, // MethodNames extracts T's methods
  >(
    methodName: K,
    // MethodArgs gets the parameters types of method K from T
    args: MethodArgs<T, K>,
  ) {
    const service = this.getDefaultReadService() as T;
    const method = service[methodName];
    try {
      if (typeof method !== "function") {
        throw new Error(
          `The method ${String(methodName)} doesn't exist or is not a function`,
        );
      }

      return await method.apply(service, args);
    } catch (error) {
      logger.error(
        `Error while calling ${String(methodName)} from ${service.IDENTIFIER}`,
        {
          defaultStorageService: this.getDefaultReadService().IDENTIFIER,
          args,
          error,
        },
      );
      throw error;
    }
  }
}
