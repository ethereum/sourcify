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
  MatchLevel,
  MatchLevelWithoutAny,
  MatchQuality,
  PathConfig,
  RepositoryTag,
} from "../../types";
import { create as createIpfsClient, IPFSHTTPClient } from "ipfs-http-client";
import logger from "../../../common/logger";
import { getAddress, id as keccak256 } from "ethers";
import { getMatchStatus } from "../../common";
import { WStorageService } from "../StorageService";
import { WStorageIdentifiers } from "./identifiers";
import { exists, readFile } from "../utils/util";

export interface RepositoryV2ServiceOptions {
  ipfsApi: string;
  repositoryPath?: string;
}

export class RepositoryV2Service implements WStorageService {
  IDENTIFIER = WStorageIdentifiers.RepositoryV2;
  repositoryPath: string;
  private ipfsClient?: IPFSHTTPClient;

  constructor(options: RepositoryV2ServiceOptions) {
    this.repositoryPath = options.repositoryPath!;
    if (options.ipfsApi) {
      this.ipfsClient = createIpfsClient({ url: options.ipfsApi });
    } else {
      logger.warn(
        "RepositoryV2: IPFS_API not set, IPFS MFS will not be updated"
      );
    }
  }

  async init() {
    logger.info(`${this.IDENTIFIER} initialized`, {
      repositoryPath: this.repositoryPath,
    });
    return true;
  }

  async getFile(
    chainId: string,
    address: string,
    match: MatchLevelWithoutAny,
    path: string
  ): Promise<string | false> {
    return await readFile(this.repositoryPath, match, chainId, address, path);
  }

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
  async save(path: string | PathConfig, content: string) {
    const abolsutePath =
      typeof path === "string"
        ? Path.join(this.repositoryPath, path)
        : this.generateAbsoluteFilePath(path);
    await fs.promises.mkdir(Path.dirname(abolsutePath), { recursive: true });
    await fs.promises.writeFile(abolsutePath, content);
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

      await this.storeSources(
        matchQuality,
        match.chainId,
        match.address,
        contract.solidity
      );

      // Store metadata
      await this.storeJSON(
        matchQuality,
        match.chainId,
        match.address,
        "metadata.json",
        contract.metadata
      );

      if (match.abiEncodedConstructorArguments) {
        await this.storeTxt(
          matchQuality,
          match.chainId,
          match.address,
          "constructor-args.txt",
          match.abiEncodedConstructorArguments
        );
      }

      if (match.creatorTxHash) {
        await this.storeTxt(
          matchQuality,
          match.chainId,
          match.address,
          "creator-tx-hash.txt",
          match.creatorTxHash
        );
      }

      if (match.libraryMap && Object.keys(match.libraryMap).length) {
        await this.storeJSON(
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
        await this.storeJSON(
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

  async deletePartialIfExists(chainId: string, address: string) {
    const pathConfig: PathConfig = {
      matchQuality: "partial",
      chainId,
      address,
      fileName: "",
    };
    const absolutePath = this.generateAbsoluteFilePath(pathConfig);

    if (await exists(absolutePath)) {
      await fs.promises.rmdir(absolutePath, { recursive: true });
    }
  }

  async updateRepositoryTag() {
    const filePath: string = Path.join(this.repositoryPath, "manifest.json");
    const timestamp = new Date().getTime();
    const tag: RepositoryTag = {
      timestamp: timestamp,
    };
    await fs.promises.writeFile(filePath, JSON.stringify(tag));
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

  private async storeSources(
    matchQuality: MatchQuality,
    chainId: string,
    address: string,
    sources: StringMap
  ) {
    for (const sourcePath in sources) {
      await this.save(
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

  private async storeJSON(
    matchQuality: MatchQuality,
    chainId: string,
    address: string,
    fileName: string,
    contentJSON: any
  ) {
    await this.save(
      {
        matchQuality,
        chainId,
        address,
        fileName,
      },
      JSON.stringify(contentJSON)
    );
  }

  private async storeTxt(
    matchQuality: MatchQuality,
    chainId: string,
    address: string,
    fileName: string,
    content: string
  ) {
    await this.save(
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
