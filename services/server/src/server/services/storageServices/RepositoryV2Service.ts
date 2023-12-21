import dirTree from "directory-tree";
import Path from "path";
import fs from "fs";
import {
  Match,
  Status,
  StringMap,
  /* ContextVariables, */
  CheckedContract,
} from "@ethereum-sourcify/lib-sourcify";
import { MatchLevel, RepositoryTag } from "../../types";
import {
  create as createIpfsClient,
  IPFSHTTPClient,
  globSource,
} from "ipfs-http-client";
import path from "path";
import { logger } from "../../../common/logger";
import { getAddress, id as keccak256 } from "ethers";
import { getMatchStatus } from "../../common";
import { IStorageService } from "../StorageService";
import config from "config";

const REPOSITORY_VERSION = "0.1";
/**
 * A type for specifying the match quality of files.
 */
type MatchQuality = "full" | "partial";

type FilesInfo<T> = { status: MatchQuality; files: Array<T> };

interface FileObject {
  name: string;
  path: string;
  content?: string;
}
type PathConfig = {
  matchQuality: MatchQuality;
  chainId: string;
  address: string;
  fileName?: string;
  source?: boolean;
};

declare interface ContractData {
  full: string[];
  partial: string[];
}

export interface RepositoryV2ServiceOptions {
  ipfsApi: string;
  repositoryPath: string;
  repositoryVersion: string;
}

interface FileObject {
  name: string;
  path: string;
  content?: string;
}

declare interface ContractData {
  full: string[];
  partial: string[];
}

export class RepositoryV2Service implements IStorageService {
  repositoryPath: string;
  private ipfsClient?: IPFSHTTPClient;

  constructor(options: RepositoryV2ServiceOptions) {
    this.repositoryPath = options.repositoryPath;
    if (options.ipfsApi) {
      this.ipfsClient = createIpfsClient({ url: options.ipfsApi });
    } else {
      logger.warn("IPFS_API not set, IPFS MFS will not be updated");
    }
  }

  async init() {
    return true;
  }

  fetchAllFileUrls(
    chain: string,
    address: string,
    match = "full_match"
  ): Array<string> {
    const files: Array<FileObject> = this.fetchAllFilePaths(
      chain,
      address,
      match
    );
    const urls: Array<string> = [];
    files.forEach((file) => {
      const relativePath =
        "contracts/" + file.path.split("/contracts")[1].substr(1);
      // TODO: Don't use repositoryV2.serverUrl but a relative URL to the server. Requires a breaking chage to the API
      urls.push(`${config.get("repositoryV2.serverUrl")}/${relativePath}`);
    });
    return urls;
  }

  /**
   * Returns all the files under the given chain and address directory.
   *
   * @param chain
   * @param address
   * @param match
   * @returns FileObject[]
   *
   * @example [
   *   { name: '0x1234.sol',
   *     path: '/home/.../repository/contracts/full_match/1/0x1234/0x1234.sol,
   *     content: "pragma solidity ^0.5.0; contract A { ... }"
   *   },
   * ... ]
   */
  fetchAllFilePaths(
    chain: string,
    address: string,
    match = "full_match"
  ): Array<FileObject> {
    const fullPath: string =
      this.repositoryPath +
      `/contracts/${match}/${chain}/${getAddress(address)}/`;
    const files: Array<FileObject> = [];
    dirTree(fullPath, {}, (item) => {
      files.push({ name: item.name, path: item.path });
    });
    return files;
  }

  fetchAllFileContents(
    chain: string,
    address: string,
    match = "full_match"
  ): Array<FileObject> {
    const files = this.fetchAllFilePaths(chain, address, match);
    for (const file in files) {
      const loadedFile = fs.readFileSync(files[file].path);
      files[file].content = loadedFile.toString();
    }

    return files;
  }
  fetchAllContracts = async (chain: String): Promise<ContractData> => {
    const fullPath = this.repositoryPath + `/contracts/full_match/${chain}/`;
    const partialPath =
      this.repositoryPath + `/contracts/partial_match/${chain}/`;
    return {
      full: fs.existsSync(fullPath) ? fs.readdirSync(fullPath) : [],
      partial: fs.existsSync(partialPath) ? fs.readdirSync(partialPath) : [],
    };
  };

  getTree = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<string>> => {
    // chainId = checkChainId(chainId); TODO: Valiadate on the controller
    const fullMatchesTree = this.fetchAllFileUrls(
      chainId,
      address,
      "full_match"
    );
    if (fullMatchesTree.length || match === "full_match") {
      return { status: "full", files: fullMatchesTree };
    }

    const files = this.fetchAllFileUrls(chainId, address, "partial_match");
    return { status: "partial", files };
  };

  getContent = async (
    chainId: string,
    address: string,
    match: MatchLevel
  ): Promise<FilesInfo<FileObject>> => {
    // chainId = checkChainId(chainId); TODO: Valiadate on the controller
    const fullMatchesFiles = this.fetchAllFileContents(
      chainId,
      address,
      "full_match"
    );
    if (fullMatchesFiles.length || match === "full_match") {
      return { status: "full", files: fullMatchesFiles };
    }

    const files = this.fetchAllFileContents(chainId, address, "partial_match");
    return { status: "partial", files };
  };

  getContracts = async (chainId: string): Promise<ContractData> => {
    const contracts = await this.fetchAllContracts(chainId);
    return contracts;
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
   * Checks if path exists and for a particular chain returns the perfect or partial match
   *
   * @param fullContractPath
   * @param partialContractPath
   */
  fetchFromStorage(
    fullContractPath: string,
    partialContractPath: string
  ): { time: Date; status: Status } {
    if (fs.existsSync(fullContractPath)) {
      return {
        time: fs.statSync(fullContractPath).birthtime,
        status: "perfect",
      };
    }

    if (fs.existsSync(partialContractPath)) {
      return {
        time: fs.statSync(partialContractPath).birthtime,
        status: "partial",
      };
    }

    throw new Error(
      `Path not found: ${fullContractPath} or ${partialContractPath}`
    );
  }

  // Checks contract existence in repository.
  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    const contractPath = this.generateAbsoluteFilePath({
      matchQuality: "full",
      chainId,
      address,
      fileName: "metadata.json",
    });

    try {
      const storageTimestamp = fs.statSync(contractPath).birthtime;
      return [
        {
          address,
          chainId,
          runtimeMatch: "perfect",
          creationMatch: null,
          storageTimestamp,
        },
      ];
    } catch (e: any) {
      logger.debug(
        `Contract (full_match) not found in repositoryV2: ${address} - chain: ${chainId}`
      );
      return [];
    }
  }

  // Checks contract existence in repository for full and partial matches.
  async checkAllByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    const fullContractPath = this.generateAbsoluteFilePath({
      matchQuality: "full",
      chainId,
      address,
      fileName: "metadata.json",
    });

    const partialContractPath = this.generateAbsoluteFilePath({
      matchQuality: "partial",
      chainId,
      address,
      fileName: "metadata.json",
    });

    try {
      const storage = this.fetchFromStorage(
        fullContractPath,
        partialContractPath
      );
      return [
        {
          address,
          chainId,
          runtimeMatch: storage?.status,
          creationMatch: null,
          storageTimestamp: storage?.time,
        },
      ];
    } catch (e: any) {
      logger.debug(
        `Contract (full & partial match) not found in repositoryV2: ${address} - chain: ${chainId}`
      );
      return [];
    }
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
    logger.debug("Saved to repositoryV2: " + abolsutePath);
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

      logger.info(
        `Stored ${contract.name} to filesystem address=${match.address} chainId=${match.chainId} match runtimeMatch=${match.runtimeMatch} creationMatch=${match.creationMatch}`
      );
      await this.addToIpfsMfs(matchQuality, match.chainId, match.address);
      logger.info(
        `Stored ${contract.name} to IPFS MFS address=${match.address} chainId=${match.chainId} match runtimeMatch=${match.runtimeMatch} creationMatch=${match.creationMatch}`
      );
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
      repositoryVersion: REPOSITORY_VERSION,
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

  private async addToIpfsMfs(
    matchQuality: MatchQuality,
    chainId: string,
    address: string
  ) {
    if (!this.ipfsClient) return;
    logger.info(`Adding ${address} on chain ${chainId} to IPFS MFS`);
    const contractFolderDir = this.generateAbsoluteFilePath({
      matchQuality,
      chainId,
      address,
    });
    const ipfsMFSDir =
      "/" +
      this.generateRelativeContractDir({
        matchQuality,
        chainId,
        address,
      });
    const filesAsyncIterable = globSource(contractFolderDir, "**/*");
    for await (const file of filesAsyncIterable) {
      if (!file.content) continue; // skip directories
      const mfsPath = path.join(ipfsMFSDir, file.path);
      try {
        // If ipfs.files.stat is successful it means the file already exists so we can skip
        await this.ipfsClient.files.stat(mfsPath);
        continue;
      } catch (e) {
        // If ipfs.files.stat fails it means the file doesn't exist, so we can add the file
      }
      await this.ipfsClient.files.mkdir(path.dirname(mfsPath), {
        parents: true,
      });
      // Readstream to Buffers
      const chunks: Uint8Array[] = [];
      for await (const chunk of file.content) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      const addResult = await this.ipfsClient.add(fileBuffer, {
        pin: false,
      });
      await this.ipfsClient.files.cp(addResult.cid, mfsPath, { parents: true });
    }
    logger.info(`Added ${address} on chain ${chainId} to IPFS MFS`);
  }
}
