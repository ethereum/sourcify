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
  IDENTIFIER: string;
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
  services: { [index: string]: IStorageService } = {};

  constructor(options: StorageServiceOptions) {
    this.enabledServices = options.enabledServices;

    // repositoryV1
    if (options.repositoryV1ServiceOptions?.repositoryPath) {
      const repositoryV1 = new RepositoryV1Service(
        this,
        options.repositoryV1ServiceOptions
      );
      this.services[repositoryV1.IDENTIFIER] = repositoryV1;
    } else {
      logger.warn(
        "Won't use RepositoryV1, path not set",
        options.repositoryV2ServiceOptions
      );
    }

    // repositoryV2
    if (options.repositoryV2ServiceOptions?.repositoryPath) {
      const repositoryV2 = new RepositoryV2Service(
        this,
        options.repositoryV2ServiceOptions
      );
      this.services[repositoryV2.IDENTIFIER] = repositoryV2;
    } else {
      logger.warn(
        "Won't use RepositoryV2, path not set",
        options.repositoryV2ServiceOptions
      );
    }

    // SourcifyDatabase
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
      logger.warn(
        "Won't use SourcifyDatabase, options not complete",
        options.sourcifyDatabaseServiceOptions
      );
    }

    // SourcifyFixedDatabase
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
      logger.warn(
        "Won't use SourcifyFixedDatabase, options not complete",
        options.sourcifyFixedDatabaseServiceOptions
      );
    }

    // AllianceDatabase
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
      logger.warn(
        "Won't use AllianceDatabase, options not complete",
        options.allianceDatabaseServiceOptions
      );
    }
  }

  getServiceByConfigKey(configKey: string): IStorageService | undefined {
    return this.services[configKey];
  }

  getDefaultReadService(): IStorageService {
    const storageService = this.getServiceByConfigKey(
      this.enabledServices.read
    );
    if (storageService === undefined) {
      logger.error("Default read storage service not enabled");
      throw new Error("Default read storage service not enabled");
    }
    return storageService;
  }

  getWriteOrWarnServices(): (IStorageService | undefined)[] {
    const writeOrWarnServices = (
      (this.enabledServices.writeOrWarn as []) || []
    ).map((serviceKey) => {
      const storageService = this.getServiceByConfigKey(serviceKey);
      if (storageService === undefined) {
        logger.warn("Storage service not enabled", {
          storageService: serviceKey,
        });
      }
      return storageService;
    });

    return writeOrWarnServices;
  }

  getWriteOrErrServices(): IStorageService[] {
    const writeOrErr = ((this.enabledServices.writeOrErr as []) || []).map(
      (serviceKey) => {
        const storageService = this.getServiceByConfigKey(serviceKey);
        if (storageService === undefined) {
          logger.error("Write storage service not enabled", {
            storageService: serviceKey,
          });
          throw new Error(`Write storage service not enabled: ${serviceKey}`);
        }
        return storageService;
      }
    );

    return writeOrErr;
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
        services: { [index: string]: IStorageService },
        service: IStorageService
      ) => {
        services[service.IDENTIFIER] = service;
        return services;
      },
      {}
    );

    logger.debug("Initializing used storage services", {
      storageServices: Object.keys(enabledServices),
    });

    // Try to initialize used storage services
    for (const serviceIdentifier of Object.keys(enabledServices)) {
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
