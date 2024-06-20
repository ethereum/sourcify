import {
  Match,
  CheckedContract,
  Status,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "../../../common/logger";
import * as Database from "../utils/database-util";
import { Pool } from "pg";
import AbstractDatabaseService from "./AbstractDatabaseService";
import { RWStorageService, StorageService } from "../StorageService";
import { bytesFromString } from "../utils/database-util";
import {
  ContractData,
  FileObject,
  FilesInfo,
  FilesRaw,
  FilesRawValue,
  MatchLevel,
  MatchLevelWithoutAny,
  PaginatedContractData,
} from "../../types";
import config from "config";
import Path from "path";
import { getFileRelativePath } from "../utils/util";
import { getAddress } from "ethers";
import { BadRequestError } from "../../../common/errors";
import { RWStorageIdentifiers, WStorageIdentifiers } from "./identifiers";
import { RepositoryV2Service } from "./RepositoryV2Service";

export interface SourcifyDatabaseServiceOptions {
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

const MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS = 200;

export class SourcifyDatabaseService
  extends AbstractDatabaseService
  implements RWStorageService
{
  storageService: StorageService;
  IDENTIFIER = RWStorageIdentifiers.SourcifyDatabase;
  databasePool!: Pool;

  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(
    storageService_: StorageService,
    options: SourcifyDatabaseServiceOptions
  ) {
    super();
    this.postgresHost = options.postgres.host;
    this.postgresPort = options.postgres.port;
    this.postgresDatabase = options.postgres.database;
    this.postgresUser = options.postgres.user;
    this.postgresPassword = options.postgres.password;
    this.storageService = storageService_;
  }

  async init() {
    return await this.initDatabasePool();
  }

  async initDatabasePool(): Promise<boolean> {
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
      throw new Error(`${this.IDENTIFIER} is disabled`);
    }

    // Checking pool health before continuing
    try {
      await this.databasePool.query("SELECT 1;");
    } catch (error) {
      logger.error(`Cannot connect to ${this.IDENTIFIER}`, {
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        error,
      });
      throw new Error(`Cannot connect to ${this.IDENTIFIER}`);
    }

    logger.info(`${this.IDENTIFIER} initialized`, {
      host: this.postgresHost,
      port: this.postgresPort,
      database: this.postgresDatabase,
    });
    return true;
  }

  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return this.checkByChainAndAddressAndMatch(address, chainId, true);
  }

  async checkAllByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    return this.checkByChainAndAddressAndMatch(address, chainId, false);
  }

  async checkByChainAndAddressAndMatch(
    address: string,
    chainId: string,
    onlyPerfectMatches: boolean = false
  ): Promise<Match[]> {
    await this.initDatabasePool();

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
          .runtime_match_status as Status,
        creationMatch: existingVerifiedContractResult.rows[0]
          .creation_match_status as Status,
        storageTimestamp: existingVerifiedContractResult.rows[0]
          .created_at as Date,
      },
    ];
  }

  getContracts = async (chainId: string): Promise<ContractData> => {
    await this.initDatabasePool();

    const res: ContractData = {
      full: [],
      partial: [],
    };
    const matchAddressesCountResult =
      await Database.countSourcifyMatchAddresses(
        this.databasePool,
        parseInt(chainId)
      );

    if (matchAddressesCountResult.rowCount === 0) {
      return res;
    }

    const fullTotal = parseInt(matchAddressesCountResult.rows[0].full_total);
    const partialTotal = parseInt(
      matchAddressesCountResult.rows[0].partial_total
    );
    if (
      fullTotal > MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS ||
      partialTotal > MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS
    ) {
      logger.info(
        "Requested more than MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS contracts",
        {
          maxReturnedContracts: MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS,
          chainId,
        }
      );
      throw new BadRequestError(
        `Cannot fetch more than ${MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS} contracts (${fullTotal} full matches, ${partialTotal} partial matches), please use /contracts/{full|any|partial}/${chainId} with pagination`
      );
    }

    if (fullTotal > 0) {
      const perfectMatchAddressesResult =
        await Database.getSourcifyMatchAddressesByChainAndMatch(
          this.databasePool,
          parseInt(chainId),
          "full_match",
          0,
          MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS
        );

      if (perfectMatchAddressesResult.rowCount > 0) {
        res.full = perfectMatchAddressesResult.rows.map((row) =>
          getAddress(row.address)
        );
      }
    }

    if (partialTotal > 0) {
      const partialMatchAddressesResult =
        await Database.getSourcifyMatchAddressesByChainAndMatch(
          this.databasePool,
          parseInt(chainId),
          "partial_match",
          0,
          MAX_RETURNED_CONTRACTS_BY_GETCONTRACTS
        );

      if (partialMatchAddressesResult.rowCount > 0) {
        res.partial = partialMatchAddressesResult.rows.map((row) =>
          getAddress(row.address)
        );
      }
    }

    return res;
  };

  getPaginatedContracts = async (
    chainId: string,
    match: MatchLevel,
    page: number,
    limit: number,
    descending: boolean = false
  ): Promise<PaginatedContractData> => {
    await this.initDatabasePool();

    // Initialize empty result
    const res: PaginatedContractData = {
      results: [],
      pagination: {
        currentPage: page,
        resultsPerPage: limit,
        resultsCurrentPage: 0,
        totalResults: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    // Count perfect and partial matches
    const matchAddressesCountResult =
      await Database.countSourcifyMatchAddresses(
        this.databasePool,
        parseInt(chainId)
      );

    if (matchAddressesCountResult.rowCount === 0) {
      return res;
    }

    // Calculate totalResults, return empty res if there are no contracts
    const fullTotal = parseInt(matchAddressesCountResult.rows[0].full_total);
    const partialTotal = parseInt(
      matchAddressesCountResult.rows[0].partial_total
    );
    const anyTotal = fullTotal + partialTotal;
    const matchTotals: Record<MatchLevel, number> = {
      full_match: fullTotal,
      partial_match: partialTotal,
      any_match: anyTotal,
    };

    // return empty res if requested `match` total is zero
    if (matchTotals[match] === 0) {
      return res;
    }
    res.pagination.totalResults = matchTotals[match];

    res.pagination.totalPages = Math.ceil(
      res.pagination.totalResults / res.pagination.resultsPerPage
    );

    // Now make the real query for addresses
    const matchAddressesResult =
      await Database.getSourcifyMatchAddressesByChainAndMatch(
        this.databasePool,
        parseInt(chainId),
        match,
        page,
        limit,
        descending
      );

    if (matchAddressesResult.rowCount > 0) {
      res.pagination.resultsCurrentPage = matchAddressesResult.rowCount;
      res.pagination.hasNextPage =
        res.pagination.currentPage * res.pagination.resultsPerPage +
          matchAddressesResult.rowCount <
        res.pagination.totalResults;
      res.pagination.hasPreviousPage =
        res.pagination.currentPage === 0 ? false : true;
      res.results = matchAddressesResult.rows.map((row) =>
        getAddress(row.address)
      );
    }

    return res;
  };

  async getMetadata(
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<string | false> {
    return (
      this.storageService.wServices[
        WStorageIdentifiers.RepositoryV2
      ] as RepositoryV2Service
    ).getMetadata(chainId, address, match);
  }

  /**
   * This function inject the metadata file in FilesInfo<T[]>
   * SourcifyDatabase.getTree and SourcifyDatabase.getContent read files from
   * `compiled_contracts.sources` where the metadata file is not available
   */
  async pushMetadataInFilesInfo<T extends string | FileObject>(
    responseWithoutMetadata: FilesInfo<T[]>,
    chainId: string,
    address: string,
    match: MatchLevel
  ) {
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
        (config.get("repositoryV1.serverUrl") + "/" + relativePath) as T
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
  }

  /**
   * getFiles extracts the files from the database `compiled_contracts.sources`
   * and store them into FilesInfo.files, this object is then going to be formatted
   * by getTree, getContent and getFile.
   */
  getFiles = async (chainId: string, address: string): Promise<FilesRaw> => {
    await this.initDatabasePool();

    const sourcifyMatchResult = await Database.getSourcifyMatchByChainAddress(
      this.databasePool,
      parseInt(chainId),
      bytesFromString(address)!
    );

    if (sourcifyMatchResult.rowCount === 0) {
      // This is how you handle a non existing contract
      return { status: "partial", files: {}, sources: {} };
    }

    const sourcifyMatch = sourcifyMatchResult.rows[0];

    // If either one of sourcify_matches.creation_match or sourcify_matches.runtime_match is perfect then "full" status
    const contractStatus =
      sourcifyMatch.creation_match_status === "perfect" ||
      sourcifyMatch.runtime_match_status === "perfect"
        ? "full"
        : "partial";

    const sources: { [index: string]: string } = {};

    // Add 'sources/' prefix for API compatibility with the repoV1 responses. RepoV1 filesystem has all source files in 'sources/'
    for (const path of Object.keys(sourcifyMatch.sources)) {
      sources[`sources/${path}`] = sourcifyMatch.sources[path];
    }
    const files: FilesRawValue = {};

    if (sourcifyMatch?.creation_values?.constructorArguments) {
      files["constructor-args.txt"] =
        sourcifyMatch.creation_values.constructorArguments;
    }

    if (sourcifyMatch?.transaction_hash) {
      const creatorTxHash = sourcifyMatch.transaction_hash.toString("hex");
      if (creatorTxHash) {
        files["creator-tx-hash.txt"] = `0x${creatorTxHash}`;
      }
    }

    if (
      sourcifyMatch?.runtime_values?.libraries &&
      Object.keys(sourcifyMatch.runtime_values.libraries).length > 0
    ) {
      files["library-map.json"] = JSON.stringify(
        sourcifyMatch.runtime_values.libraries
      );
    }

    if (
      sourcifyMatch?.runtime_code_artifacts?.immutableReferences &&
      Object.keys(sourcifyMatch.runtime_code_artifacts.immutableReferences)
        .length > 0
    ) {
      files["immutable-references.json"] = JSON.stringify(
        sourcifyMatch.runtime_code_artifacts.immutableReferences
      );
    }

    return { status: contractStatus, sources, files };
  };

  getFile = async (
    chainId: string,
    address: string,
    match: MatchLevelWithoutAny,
    path: string
  ): Promise<string | false> => {
    // this.getFiles queries sourcify_match, it extract always one and only one match
    // there could never be two matches with different MatchLevelWithoutAny inside sourcify_match
    const { status, files, sources } = await this.getFiles(chainId, address);

    if (Object.keys(sources).length === 0) {
      return false;
    }

    // returned getFile.status should equal requested MatchLevelWithoutAny
    if (status === "full" && match !== "full_match") {
      return false;
    }
    if (status === "partial" && match !== "partial_match") {
      return false;
    }

    // For getFile we cannot use getMetadata, since it returns metadata based on MatchLevel logic
    // we use RepositoryV2Service.getFile to extract metadata.json specifying "full_match" or "partial_match"
    const metadata = await (
      this.storageService.wServices[
        WStorageIdentifiers.RepositoryV2
      ] as RepositoryV2Service
    ).getFile(chainId, address, match, "metadata.json");

    if (metadata === false) {
      throw new Error("Metadata doesn't exist for this file");
    }

    const allFiles: { [index: string]: string } = {
      ...files,
      ...sources,
      "metadata.json": metadata,
    };

    if (match === "full_match" && status === "full") {
      return allFiles[path];
    }

    if (match === "partial_match" && status === "partial") {
      return allFiles[path];
    }

    return false;
  };

  /**
   * getTree returns FilesInfo in which files contains for each source its repository url
   */
  getTree = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<string[]>> => {
    const {
      status: contractStatus,
      sources: sourcesRaw,
      files: filesRaw,
    } = await this.getFiles(chainId, address);

    const emptyResponse: FilesInfo<string[]> = {
      status: "full",
      files: [],
    };

    // If "full_match" files are requested but the contractStatus if partial return empty
    if (match === "full_match" && contractStatus === "partial") {
      return emptyResponse;
    }

    // Calculate the the repository's url for each file
    const sourcesWithUrl = Object.keys(sourcesRaw).map((source) => {
      const relativePath = getFileRelativePath(
        chainId,
        address,
        contractStatus,
        source
      );
      return `${config.get("repositoryV1.serverUrl")}/${relativePath}`;
    });

    const filesWithUrl = Object.keys(filesRaw).map((file) => {
      const relativePath = getFileRelativePath(
        chainId,
        address,
        contractStatus,
        file
      );
      return `${config.get("repositoryV1.serverUrl")}/${relativePath}`;
    });

    const responseWithoutMetadata = {
      status: contractStatus,
      files: [...sourcesWithUrl, ...filesWithUrl],
    };

    // if files is empty it means that the contract doesn't exist
    if (responseWithoutMetadata.files.length === 0) {
      return emptyResponse;
    }

    await this.pushMetadataInFilesInfo<string>(
      responseWithoutMetadata,
      chainId,
      address,
      match
    );

    return responseWithoutMetadata;
  };

  /**
   * getContent returns FilesInfo in which files contains for each source its FileObject,
   * an object that includes the content of the file.
   */
  getContent = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<Array<FileObject>>> => {
    const {
      status: contractStatus,
      sources: sourcesRaw,
      files: filesRaw,
    } = await this.getFiles(chainId, address);

    const emptyResponse: FilesInfo<Array<FileObject>> = {
      status: "full",
      files: [],
    };

    // If "full_match" files are requestd but the contractStatus if partial return empty
    if (match === "full_match" && contractStatus === "partial") {
      return emptyResponse;
    }

    // Calculate the the repository's url for each file
    const sourcesWithUrl = Object.keys(sourcesRaw).map((source) => {
      const relativePath = getFileRelativePath(
        chainId,
        address,
        contractStatus,
        source
      );

      return {
        name: Path.basename(source),
        path: relativePath,
        content: sourcesRaw[source],
      } as FileObject;
    });

    const filesWithUrl = Object.keys(filesRaw).map((file) => {
      const relativePath = getFileRelativePath(
        chainId,
        address,
        contractStatus,
        file
      );

      return {
        name: Path.basename(file),
        path: relativePath,
        content: filesRaw[file],
      } as FileObject;
    });

    const responseWithoutMetadata = {
      status: contractStatus,
      files: [...sourcesWithUrl, ...filesWithUrl],
    };

    // if files is empty it means that the contract doesn't exist
    if (responseWithoutMetadata.files.length === 0) {
      return emptyResponse;
    }

    await this.pushMetadataInFilesInfo<FileObject>(
      responseWithoutMetadata,
      chainId,
      address,
      match
    );

    return responseWithoutMetadata;
  };

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
    const { type, verifiedContractId, oldVerifiedContractId } =
      await super.insertOrUpdateVerifiedContract(recompiledContract, match);

    if (type === "insert") {
      if (!verifiedContractId) {
        throw new Error(
          "VerifiedContractId undefined before inserting sourcify match"
        );
      }
      await Database.insertSourcifyMatch(this.databasePool, {
        verified_contract_id: verifiedContractId,
        creation_match: match.creationMatch,
        runtime_match: match.runtimeMatch,
      });
      logger.info("Stored to SourcifyDatabase", {
        address: match.address,
        chainId: match.chainId,
        runtimeMatch: match.runtimeMatch,
        creationMatch: match.creationMatch,
      });
    } else if (type === "update") {
      // If insertOrUpdateVerifiedContract returned an update with verifiedContractId=false
      // it means that the new match wasn't better (perfect > partial) than the existing one
      if (verifiedContractId === false) {
        logger.info("Not Updated in SourcifyDatabase", {
          address: match.address,
          chainId: match.chainId,
          runtimeMatch: match.runtimeMatch,
          creationMatch: match.creationMatch,
        });
        return;
      }
      if (!oldVerifiedContractId) {
        throw new Error(
          "oldVerifiedContractId undefined before updating sourcify match"
        );
      }
      await Database.updateSourcifyMatch(
        this.databasePool,
        {
          verified_contract_id: verifiedContractId,
          creation_match: match.creationMatch,
          runtime_match: match.runtimeMatch,
        },
        oldVerifiedContractId
      );
      logger.info("Updated in SourcifyDatabase", {
        address: match.address,
        chainId: match.chainId,
        runtimeMatch: match.runtimeMatch,
        creationMatch: match.creationMatch,
      });
    } else {
      throw new Error(
        "insertOrUpdateVerifiedContract returned a type that doesn't exist"
      );
    }
  }
}
