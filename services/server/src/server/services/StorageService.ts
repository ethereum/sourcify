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
import { getFileRelativePath } from "./utils/util";
import config from "config";
import { BadRequestError } from "../../common/errors";

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
  sourcifyFixedDatabaseServiceOptions?: SourcifyDatabaseServiceOptions;
  allianceDatabaseServiceOptions?: AllianceDatabaseServiceOptions;
}

export class StorageService {
  repositoryV1: RepositoryV1Service;
  repositoryV2?: RepositoryV2Service;
  sourcifyDatabase?: SourcifyDatabaseService;
  sourcifyFixedDatabase?: SourcifyDatabaseService;
  allianceDatabase?: AllianceDatabaseService;

  constructor(options: StorageServiceOptions) {
    // repositoryV1
    this.repositoryV1 = new RepositoryV1Service(
      options.repositoryV1ServiceOptions
    );

    // repositoryV2
    if (options.repositoryV2ServiceOptions?.repositoryPath) {
      this.repositoryV2 = new RepositoryV2Service(
        options.repositoryV2ServiceOptions
      );
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
      this.sourcifyDatabase = new SourcifyDatabaseService(
        options.sourcifyDatabaseServiceOptions
      );
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
      this.sourcifyFixedDatabase = new SourcifyDatabaseService(
        options.sourcifyFixedDatabaseServiceOptions
      );
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
      this.allianceDatabase = new AllianceDatabaseService(
        options.allianceDatabaseServiceOptions
      );
    } else {
      logger.warn(
        "Won't use AllianceDatabase, options not complete",
        options.allianceDatabaseServiceOptions
      );
    }
  }

  getMetadata = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<string | false> => {
    return this.repositoryV2!.getMetadata(chainId, address, match);
  };

  /**
   * This function inject the metadata file in FilesInfo<T[]>
   * SourcifyDatabase.getTree and SourcifyDatabase.getContent read files from
   * `compiled_contracts.sources` where the metadata file is not available
   */
  pushMetadataInFilesInfo = async <T extends string | FileObject>(
    responseWithoutMetadata: FilesInfo<T[]>,
    chainId: string,
    address: string,
    match: MatchLevel
  ) => {
    const metadata = await this.getMetadata(
      chainId,
      address,
      responseWithoutMetadata.status === "full" ? "full_match" : "any_match"
    );

    if (!metadata) {
      logger.error("Contract exists in the database but not in RepositoryV2", {
        chainId,
        address,
        match,
      });
      throw new Error(
        "Contract exists in the database but not in RepositoryV2"
      );
    }

    const relativePath = getFileRelativePath(
      chainId,
      address,
      responseWithoutMetadata.status,
      "metadata.json"
    );

    if (typeof responseWithoutMetadata.files[0] === "string") {
      // If this function is called with T == string
      responseWithoutMetadata.files.push(
        (config.get("repositoryV1.serverUrl") + relativePath) as T
      );
    } else {
      // If this function is called with T === FileObject
      // It's safe to handle this case in the else because of <T extends string | FileObject>
      responseWithoutMetadata.files.push({
        name: "metadata.json",
        path: relativePath,
        content: metadata,
      } as T);
    }
  };

  getFile = async (
    chainId: string,
    address: string,
    match: MatchLevel,
    path: string
  ): Promise<string | false> => {
    try {
      return this.sourcifyDatabase!.getFile(chainId, address, match, path);
    } catch (error) {
      logger.error("Error while getting file from database", {
        chainId,
        address,
        match,
        path,
        error,
      });
      throw new Error("Error while getting file from database");
    }
  };

  getTree = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<string[]>> => {
    let responseWithoutMetadata;
    try {
      responseWithoutMetadata = await this.sourcifyDatabase!.getTree(
        chainId,
        address,
        match
      );
    } catch (error) {
      logger.error("Error while getting tree from database", {
        chainId,
        address,
        match,
        error,
      });
      throw new Error("Error while getting tree from database");
    }

    // if files is empty it means that the contract doesn't exist
    if (responseWithoutMetadata.files.length === 0) {
      return responseWithoutMetadata;
    }

    await this.pushMetadataInFilesInfo<string>(
      responseWithoutMetadata,
      chainId,
      address,
      match
    );

    return responseWithoutMetadata;
  };

  getContent = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<Array<FileObject>>> => {
    let responseWithoutMetadata;
    try {
      responseWithoutMetadata = await this.sourcifyDatabase!.getContent(
        chainId,
        address,
        match
      );
    } catch (error) {
      logger.error("Error while getting content from database", {
        chainId,
        address,
        match,
        error,
      });
      throw new Error("Error while getting content from database");
    }

    // if files is empty it means that the contract doesn't exist
    if (responseWithoutMetadata.files.length === 0) {
      return responseWithoutMetadata;
    }

    await this.pushMetadataInFilesInfo<FileObject>(
      responseWithoutMetadata,
      chainId,
      address,
      match
    );

    return responseWithoutMetadata;
  };

  getContracts = async (chainId: string): Promise<ContractData> => {
    try {
      return this.sourcifyDatabase!.getContracts(chainId);
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.error("Error while getting contracts from database", {
        chainId,
        error,
      });
      throw new Error("Error while getting contracts from database");
    }
  };

  getPaginatedContracts = (
    chainId: string,
    match: MatchLevel,
    page: number,
    limit: number,
    descending: boolean = false
  ): Promise<PaginatedContractData> => {
    try {
      return this.sourcifyDatabase!.getPaginatedContracts(
        chainId,
        match,
        page,
        limit,
        descending
      );
    } catch (error) {
      logger.error("Error while getting paginated contracts from database", {
        chainId,
        match,
        page,
        limit,
        descending,
        error,
      });
      throw new Error("Error while getting paginated contracts from database");
    }
  };

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
      (await this.sourcifyDatabase?.checkByChainAndAddress?.(
        address,
        chainId,
        true
      )) || []
    );
  }

  async checkAllByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return (
      (await this.sourcifyDatabase?.checkByChainAndAddress?.(
        address,
        chainId,
        false
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

    // Sourcify Database and RepositoryV2 must be enabled
    if (!this.sourcifyDatabase) {
      throw new Error("SourcifyDatabase must be enabled");
    }
    if (!this.repositoryV2) {
      throw new Error("RepositoryV2 must be enabled");
    }

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
    const promises = [];

    // Conditionally push promises to the array based on service availability
    if (this.allianceDatabase) {
      if (!match.creationMatch) {
        logger.warn(`Can't store to AllianceDatabase without creationMatch`, {
          name: contract.name,
          address: match.address,
          chainId: match.chainId,
          runtimeMatch: match.runtimeMatch,
          creationMatch: match.creationMatch,
        });
      } else {
        promises.push(
          this.allianceDatabase.storeMatch(contract, match).catch((e) =>
            logger.error("Error storing to AllianceDatabase: ", {
              error: e,
            })
          )
        );
      }
    }

    // @deprecated
    if (this.repositoryV1) {
      promises.push(
        this.repositoryV1
          .storeMatch(contract, match)
          .catch((e) =>
            logger.error("Error storing to RepositoryV1: ", { error: e })
          )
      );
    }

    // Add by default both sourcifyDatabase and repositoryV2
    promises.push(
      this.sourcifyDatabase.storeMatch(contract, match).catch((e) => {
        logger.error("Error storing to SourcifyDatabase: ", {
          error: e,
        });
        throw e;
      })
    );

    if (this.sourcifyFixedDatabase) {
      promises.push(
        this.sourcifyFixedDatabase.storeMatch(contract, match).catch((e) => {
          logger.error("Error storing to SourcifyFixedDatabase: ", {
            error: e,
          });
          throw e;
        })
      );
    }

    promises.push(
      this.repositoryV2.storeMatch(contract, match).catch((e) => {
        logger.error("Error storing to RepositoryV2: ", {
          error: e,
        });
        throw e;
      })
    );

    return await Promise.all(promises);
  }
}
