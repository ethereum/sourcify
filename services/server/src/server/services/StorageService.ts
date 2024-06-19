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
import { getMatchStatus } from "../common";
import {
  ContractData,
  FileObject,
  FilesInfo,
  MatchLevel,
  PaginatedContractData,
} from "../types";
import { BadRequestError } from "../../common/errors";
import { StorageIdentifiers } from "./storageServices/identifiers";

export interface IStorageService {
  IDENTIFIER: StorageIdentifiers;
  storageService: StorageService;
  init(): Promise<boolean>;
  getMetadata(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<string | false>;
  getFile(
    chainId: string,
    address: string,
    match: MatchLevel,
    path: string
  ): Promise<string | false>;
  getTree(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<string[]>>;
  getContent(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<Array<FileObject>>>;
  getContracts(chainId: string): Promise<ContractData>;
  getPaginatedContracts(
    chainId: string,
    match: MatchLevel,
    page: number,
    limit: number,
    descending: boolean
  ): Promise<PaginatedContractData>;
  checkByChainAndAddress?(address: string, chainId: string): Promise<Match[]>;
  checkAllByChainAndAddress?(
    address: string,
    chainId: string
  ): Promise<Match[]>;
  storeMatch(contract: CheckedContract, match: Match): Promise<void | Match>;
}

export interface EnabledServices {
  read: StorageIdentifiers;
  writeOrWarn: StorageIdentifiers[];
  writeOrErr: StorageIdentifiers[];
}

export interface StorageServiceOptions {
  enabledServices: EnabledServices;
  repositoryV1ServiceOptions: RepositoryV1ServiceOptions;
  repositoryV2ServiceOptions: RepositoryV2ServiceOptions;
  sourcifyDatabaseServiceOptions?: SourcifyDatabaseServiceOptions;
  sourcifyFixedDatabaseServiceOptions?: SourcifyDatabaseServiceOptions;
  allianceDatabaseServiceOptions?: AllianceDatabaseServiceOptions;
}

export class StorageService {
  enabledServices: EnabledServices;
  services: { [key in StorageIdentifiers]: IStorageService } = {} as {
    [key in StorageIdentifiers]: IStorageService;
  };

  constructor(options: StorageServiceOptions) {
    this.enabledServices = options.enabledServices;

    const enabledServicesArray = [
      this.enabledServices.read,
      ...this.enabledServices.writeOrWarn,
      ...this.enabledServices.writeOrErr,
    ];

    // repositoryV1
    if (enabledServicesArray.includes(StorageIdentifiers.RepositoryV1)) {
      if (options.repositoryV1ServiceOptions?.repositoryPath) {
        const repositoryV1 = new RepositoryV1Service(
          this,
          options.repositoryV1ServiceOptions
        );
        this.services[repositoryV1.IDENTIFIER] = repositoryV1;
      } else {
        logger.error(
          "RepositoryV1 enabled, but path not set",
          options.repositoryV2ServiceOptions
        );
        throw new Error("RepositoryV1 enabled, but path not set");
      }
    }

    // repositoryV2
    if (enabledServicesArray.includes(StorageIdentifiers.RepositoryV2)) {
      if (options.repositoryV2ServiceOptions?.repositoryPath) {
        const repositoryV2 = new RepositoryV2Service(
          this,
          options.repositoryV2ServiceOptions
        );
        this.services[repositoryV2.IDENTIFIER] = repositoryV2;
      } else {
        logger.error(
          "RepositoryV2 enabled, but path not set",
          options.repositoryV2ServiceOptions
        );
        throw new Error("RepositoryV2 enabled, but path not set");
      }
    }

    // SourcifyDatabase
    if (enabledServicesArray.includes(StorageIdentifiers.SourcifyDatabase)) {
      if (
        options.sourcifyDatabaseServiceOptions?.postgres?.host &&
        options.sourcifyDatabaseServiceOptions?.postgres?.database &&
        options.sourcifyDatabaseServiceOptions?.postgres?.user &&
        options.sourcifyDatabaseServiceOptions?.postgres?.password
      ) {
        const sourcifyDatabase = new SourcifyDatabaseService(
          this,
          options.sourcifyDatabaseServiceOptions
        );
        this.services[sourcifyDatabase.IDENTIFIER] = sourcifyDatabase;
      } else {
        logger.error(
          "SourcifyDatabase enabled, but options are not complete",
          options.sourcifyDatabaseServiceOptions
        );
        throw new Error(
          "SourcifyDatabase enabled, but options are not complete"
        );
      }
    }

    // SourcifyFixedDatabase
    if (
      enabledServicesArray.includes(StorageIdentifiers.SourcifyFixedDatabase)
    ) {
      if (
        options.sourcifyFixedDatabaseServiceOptions?.postgres?.host &&
        options.sourcifyFixedDatabaseServiceOptions?.postgres?.database &&
        options.sourcifyFixedDatabaseServiceOptions?.postgres?.user &&
        options.sourcifyFixedDatabaseServiceOptions?.postgres?.password
      ) {
        const sourcifyFixedDatabase = new SourcifyDatabaseService(
          this,
          options.sourcifyFixedDatabaseServiceOptions
        );
        sourcifyFixedDatabase.IDENTIFIER =
          StorageIdentifiers.SourcifyFixedDatabase;
        this.services[sourcifyFixedDatabase.IDENTIFIER] = sourcifyFixedDatabase;
      } else {
        logger.error(
          "SourcifyFixedDatabase enabled, but options are not complete",
          options.sourcifyFixedDatabaseServiceOptions
        );
        throw new Error(
          "SourcifyFixedDatabase enabled, but options are not complete"
        );
      }
    }

    // AllianceDatabase
    if (enabledServicesArray.includes(StorageIdentifiers.AllianceDatabase)) {
      if (
        options.allianceDatabaseServiceOptions?.googleCloudSql ||
        (options.allianceDatabaseServiceOptions?.postgres?.host &&
          options.allianceDatabaseServiceOptions?.postgres?.database &&
          options.allianceDatabaseServiceOptions?.postgres?.user &&
          options.allianceDatabaseServiceOptions?.postgres?.password)
      ) {
        const allianceDatabase = new AllianceDatabaseService(
          this,
          options.allianceDatabaseServiceOptions
        );
        this.services[allianceDatabase.IDENTIFIER] = allianceDatabase;
      } else {
        logger.error(
          "AllianceDatabase enabled, but options are not complete",
          options.allianceDatabaseServiceOptions
        );
        throw new Error(
          "AllianceDatabase enabled, but options are not complete"
        );
      }
    }
  }

  getServiceByConfigKey(configKey: StorageIdentifiers): IStorageService {
    return this.services[configKey];
  }

  getDefaultReadService(): IStorageService {
    return this.getServiceByConfigKey(this.enabledServices.read);
  }

  getWriteOrWarnServices(): IStorageService[] {
    return this.enabledServices.writeOrWarn.map((serviceKey) =>
      this.getServiceByConfigKey(serviceKey)
    );
  }

  getWriteOrErrServices(): IStorageService[] {
    return this.enabledServices.writeOrErr.map((serviceKey) =>
      this.getServiceByConfigKey(serviceKey)
    );
  }

  async init() {
    // Initialized only the used storage services

    // Get list of used storage services
    const enabledServicesArray = [
      this.getDefaultReadService(),
      ...this.getWriteOrWarnServices(),
      ...this.getWriteOrErrServices(),
    ].filter((service) => service !== undefined) as IStorageService[];

    // Create object: StorageIdentifier => Storage
    const enabledServices = enabledServicesArray.reduce(
      (
        services: { [key in StorageIdentifiers]: IStorageService },
        service: IStorageService
      ) => {
        services[service.IDENTIFIER] = service;
        return services;
      },
      {} as { [key in StorageIdentifiers]: IStorageService }
    );

    logger.debug("Initializing used storage services", {
      storageServices: Object.keys(enabledServices),
    });

    // Try to initialize used storage services
    for (const serviceIdentifier of Object.keys(
      enabledServices
    ) as StorageIdentifiers[]) {
      if (!(await this.services[serviceIdentifier].init())) {
        throw new Error(
          "Cannot initialize default storage service: " + serviceIdentifier
        );
      }
    }
  }

  async getMetadata(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<string | false> {
    return this.getDefaultReadService().getMetadata(chainId, address, match);
  }

  async getFile(
    chainId: string,
    address: string,
    match: MatchLevel,
    path: string
  ): Promise<string | false> {
    try {
      return this.getDefaultReadService().getFile(
        chainId,
        address,
        match,
        path
      );
    } catch (error) {
      logger.error(
        "Error while getting file from default read storage service",
        {
          defaultStorageService: this.getDefaultReadService().IDENTIFIER,
          address,
          match,
          path,
          error,
        }
      );
      throw new Error(
        "Error while getting file from default read storage service"
      );
    }
  }

  async getTree(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<string[]>> {
    try {
      return await this.getDefaultReadService().getTree(
        chainId,
        address,
        match
      );
    } catch (error) {
      logger.error(
        "Error while getting tree from default read storage service",
        {
          defaultStorageService: this.getDefaultReadService().IDENTIFIER,
          chainId,
          address,
          match,
          error,
        }
      );
      throw new Error(
        "Error while getting tree from default read storage service"
      );
    }
  }

  async getContent(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<Array<FileObject>>> {
    try {
      return await this.getDefaultReadService().getContent(
        chainId,
        address,
        match
      );
    } catch (error) {
      logger.error(
        "Error while getting content from default read storage service",
        {
          defaultStorageService: this.getDefaultReadService().IDENTIFIER,
          chainId,
          address,
          match,
          error,
        }
      );
      throw new Error(
        "Error while getting content from default read storage service"
      );
    }
  }

  async getContracts(chainId: string): Promise<ContractData> {
    try {
      return this.getDefaultReadService().getContracts(chainId);
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.error(
        "Error while getting contracts from default read storage service",
        {
          defaultStorageService: this.getDefaultReadService().IDENTIFIER,
          chainId,
          error,
        }
      );
      throw new Error(
        "Error while getting contracts from default read storage service"
      );
    }
  }

  getPaginatedContracts(
    chainId: string,
    match: MatchLevel,
    page: number,
    limit: number,
    descending: boolean = false
  ): Promise<PaginatedContractData> {
    try {
      return this.getDefaultReadService().getPaginatedContracts(
        chainId,
        match,
        page,
        limit,
        descending
      );
    } catch (error) {
      logger.error(
        "Error while getting paginated contracts from default read storage service",
        {
          defaultStorageService: this.getDefaultReadService().IDENTIFIER,
          chainId,
          match,
          page,
          limit,
          descending,
          error,
        }
      );
      throw new Error(
        "Error while getting paginated contracts from default read storage service"
      );
    }
  }

  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return (
      (await this.getDefaultReadService().checkByChainAndAddress?.(
        address,
        chainId
      )) || []
    );
  }

  async checkAllByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return (
      (await this.getDefaultReadService().checkAllByChainAndAddress?.(
        address,
        chainId
      )) || []
    );
  }

  async storeMatch(contract: CheckedContract, match: Match) {
    logger.info("Storing match on StorageService", {
      name: contract.name,
      address: match.address,
      chainId: match.chainId,
      runtimeMatch: match.runtimeMatch,
      creationMatch: match.creationMatch,
    });

    const existingMatch = await this.checkAllByChainAndAddress(
      match.address,
      match.chainId
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
      throw new Error(
        `The contract ${match.address} on chainId ${match.chainId} is already partially verified. The provided new source code also yielded a partial match and will not be stored unless it's a full match`
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
        })
      )
    );

    this.getWriteOrWarnServices().forEach((service) => {
      if (service) {
        promises.push(
          service.storeMatch(contract, match).catch((e) => {
            logger.error(`Error storing to ${service.IDENTIFIER}`, {
              error: e,
            });
          })
        );
      }
    });

    return await Promise.all(promises);
  }
}
