/**
 * This is a temporary service used only during the synchronization process.
 *
 * After the synchronization process, this service will be updated to point to
 * an external Repository Service.
 */

import Path from "path";
import fs from "fs";
import {
  Match,
  Status,
  StringMap,
  CheckedContract,
} from "@ethereum-sourcify/lib-sourcify";
import {
  ContractData,
  FileObject,
  FilesInfo,
  MatchLevel,
  MatchQuality,
  PaginatedContractData,
  PathConfig,
  RepositoryTag,
} from "../../types";
import {
  create as createIpfsClient,
  IPFSHTTPClient,
  globSource,
} from "ipfs-http-client";
import logger from "../../../common/logger";
import { getAddress, id as keccak256 } from "ethers";
import { getMatchStatus } from "../../common";
import { IStorageService, StorageService } from "../StorageService";
import { StorageIdentifiers } from "./identifiers";

export interface RepositoryV2ServiceOptions {
  ipfsApi: string;
  repositoryPath?: string;
}

export class RepositoryV2Service implements IStorageService {
  IDENTIFIER = StorageIdentifiers.RepositoryV2;
  storageService: StorageService;
  repositoryPath: string;
  private ipfsClient?: IPFSHTTPClient;

  constructor(
    storageService_: StorageService,
    options: RepositoryV2ServiceOptions
  ) {
    this.storageService = storageService_;
    this.repositoryPath = options.repositoryPath!;
    if (options.ipfsApi) {
      this.ipfsClient = createIpfsClient({ url: options.ipfsApi });
    } else {
      logger.warn(
        "RepositoryV2: IPFS_API not set, IPFS MFS will not be updated"
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFile(..._: any): Promise<string | false> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getTree(..._: any): Promise<FilesInfo<string[]>> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getContent(..._: any): Promise<FilesInfo<FileObject[]>> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getContracts(..._: any): Promise<ContractData> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPaginatedContracts(..._: any): Promise<PaginatedContractData> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkByChainAndAddress(..._: any): Promise<Match[]> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkAllByChainAndAddress(..._: any): Promise<Match[]> {
    throw new Error("Method not implemented.");
  }

  async init() {
    logger.info(`${this.IDENTIFIER} initialized`, {
      repositoryPath: this.repositoryPath,
    });
    return true;
  }

  getMetadata = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<string | false> => {
    try {
      return fs.readFileSync(
        this.generateAbsoluteFilePath({
          matchQuality: match === "full_match" ? "full" : "partial",
          chainId: chainId,
          address: address,
          fileName: "metadata.json",
        }),
        { encoding: "utf-8" }
      );
    } catch (e) {
      return false;
    }
  };

  // /home/user/sourcify/data/repository/contracts/full_match/5/0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4/sources/filename
  public generateAbsoluteFilePath(pathConfig: PathConfig) {
    return Path.join(
      this.repositoryPath,
      this.generateRelativeFilePath(pathConfig)
    );
  }

  // contracts/full_match/5/0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4/sources/filename
  public generateRelativeFilePath(pathConfig: PathConfig) {
    return Path.join(
      this.generateRelativeContractDir(pathConfig),
      pathConfig.source ? "sources" : "",
      pathConfig.fileName || ""
    );
  }

  // contracts/full_match/5/0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4
  public generateRelativeContractDir(pathConfig: PathConfig) {
    return Path.join(
      "contracts",
      `${pathConfig.matchQuality}_match`,
      pathConfig.chainId,
      getAddress(pathConfig.address)
    );
  }

  /**
   * Save file to repository and update the repository tag. The path may include non-existent parent directories.
   *
   * @param path the path within the repository where the file will be stored
   * @param content the content to be stored
   */
  save(path: string | PathConfig, content: string) {
    const abolsutePath =
      typeof path === "string"
        ? Path.join(this.repositoryPath, path)
        : this.generateAbsoluteFilePath(path);
    fs.mkdirSync(Path.dirname(abolsutePath), { recursive: true });
    fs.writeFileSync(abolsutePath, content);
    logger.silly("Saved file to repositoryV2", { abolsutePath });
    this.updateRepositoryTag();
  }

  public async storeMatch(
    contract: CheckedContract,
    match: Match
  ): Promise<void | Match> {
    if (
      match.address &&
      (match.runtimeMatch === "perfect" ||
        match.runtimeMatch === "partial" ||
        match.creationMatch === "perfect" ||
        match.creationMatch === "partial")
    ) {
      // Delete the partial matches if we now have a perfect match instead.
      if (
        match.runtimeMatch === "perfect" ||
        match.creationMatch === "perfect"
      ) {
        this.deletePartialIfExists(match.chainId, match.address);
      }
      const matchQuality: MatchQuality = this.statusToMatchQuality(
        getMatchStatus(match)
      );

      this.storeSources(
        matchQuality,
        match.chainId,
        match.address,
        contract.solidity
      );

      // Store metadata
      this.storeJSON(
        matchQuality,
        match.chainId,
        match.address,
        "metadata.json",
        contract.metadata
      );

      if (match.abiEncodedConstructorArguments) {
        this.storeTxt(
          matchQuality,
          match.chainId,
          match.address,
          "constructor-args.txt",
          match.abiEncodedConstructorArguments
        );
      }

      if (match.creatorTxHash) {
        this.storeTxt(
          matchQuality,
          match.chainId,
          match.address,
          "creator-tx-hash.txt",
          match.creatorTxHash
        );
      }

      if (match.libraryMap && Object.keys(match.libraryMap).length) {
        this.storeJSON(
          matchQuality,
          match.chainId,
          match.address,
          "library-map.json",
          match.libraryMap
        );
      }

      if (
        match.immutableReferences &&
        Object.keys(match.immutableReferences).length > 0
      ) {
        this.storeJSON(
          matchQuality,
          match.chainId,
          match.address,
          "immutable-references.json",
          match.immutableReferences
        );
      }

      logger.info("Stored contract to RepositoryV2", {
        address: match.address,
        chainId: match.chainId,
        runtimeMatch: match.runtimeMatch,
        creationMatch: match.creationMatch,
        name: contract.name,
      });
    } else if (match.runtimeMatch === "extra-file-input-bug") {
      return match;
    } else {
      throw new Error(`Unknown match status: ${match.runtimeMatch}`);
    }
  }

  deletePartialIfExists(chainId: string, address: string) {
    const pathConfig: PathConfig = {
      matchQuality: "partial",
      chainId,
      address,
      fileName: "",
    };
    const absolutePath = this.generateAbsoluteFilePath(pathConfig);

    if (fs.existsSync(absolutePath)) {
      fs.rmdirSync(absolutePath, { recursive: true });
    }
  }

  updateRepositoryTag() {
    const filePath: string = Path.join(this.repositoryPath, "manifest.json");
    const timestamp = new Date().getTime();
    const tag: RepositoryTag = {
      timestamp: timestamp,
    };
    fs.writeFileSync(filePath, JSON.stringify(tag));
  }

  /**
   * This method exists because many different people have contributed to this code, which has led to the
   * lack of unanimous nomenclature
   * @param status
   * @returns {MatchQuality} matchQuality
   */
  private statusToMatchQuality(status: Status): MatchQuality {
    if (status === "perfect") return "full";
    if (status === "partial") return status;
    throw new Error(`Invalid match status: ${status}`);
  }

  private storeSources(
    matchQuality: MatchQuality,
    chainId: string,
    address: string,
    sources: StringMap
  ) {
    for (const sourcePath in sources) {
      this.save(
        {
          matchQuality,
          chainId,
          address,
          source: true,
          // Store the file with the keccak as name
          fileName: `${keccak256(sources[sourcePath])}.sol`,
        },
        sources[sourcePath]
      );
    }
  }

  private storeJSON(
    matchQuality: MatchQuality,
    chainId: string,
    address: string,
    fileName: string,
    contentJSON: any
  ) {
    this.save(
      {
        matchQuality,
        chainId,
        address,
        fileName,
      },
      JSON.stringify(contentJSON)
    );
  }

  private storeTxt(
    matchQuality: MatchQuality,
    chainId: string,
    address: string,
    fileName: string,
    content: string
  ) {
    this.save(
      {
        matchQuality,
        chainId,
        address,
        source: false,
        fileName,
      },
      content
    );
  }
}
