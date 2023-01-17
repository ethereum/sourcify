import dirTree from "directory-tree";
import Path from "path";
import fs from "fs";
import { Match, Status, Create2Args } from "@ethereum-sourcify/lib-sourcify";
import { SourcifyEventManager } from "./EventManager";
import { toChecksumAddress } from "web3-utils";
import { MatchLevel, RepositoryTag } from "../types";

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
  chain: string;
  address: string;
  fileName?: string;
  source?: boolean;
};

declare interface ContractData {
  full: string[];
  partial: string[];
}

export interface IRepositoryService {
  // getTreeByChainAndAddress(
  //   chainId: string,
  //   address: string
  // ): Promise<Array<string>>;
  // getByChainAndAddress(
  //   chainId: string,
  //   address: string
  // ): Promise<Array<FileObject>>;
  fetchAllFileUrls(chain: string, address: string): Array<string>;
  fetchAllFilePaths(chain: string, address: string): Array<FileObject>;
  fetchAllFileContents(chain: string, address: string): Array<FileObject>;
  checkByChainAndAddress(address: string, chain: string): Match[];
  checkAllByChainAndAddress(address: string, chain: string): Match[];
  save(path: string | PathConfig, file: string): void;
  deletePartialIfExists(chain: string, address: string): void;
  repositoryPath: string;
  getTree(
    chainId: string,
    address: string,
    match: string
  ): Promise<FilesInfo<string>>;
  getContent(
    chainId: string,
    address: string,
    match: string
  ): Promise<FilesInfo<FileObject>>;
  getContracts(chainId: string): Promise<ContractData>;
  generateAbsoluteFilePath(pathConfig: PathConfig): string;
  generateRelativeFilePath(pathConfig: PathConfig): string;
  generateRelativeContractDir(pathConfig: PathConfig): string;
}
export default class RepositoryService implements IRepositoryService {
  repositoryPath: string;

  constructor(repositoryPath: string) {
    this.repositoryPath = repositoryPath;
  }
  // Not used anywhere
  // async getTreeByChainAndAddress(
  //   chainId: string,
  //   address: string
  // ): Promise<string[]> {
  //   chainId = checkChainId(chainId);
  //   return this.fetchAllFileUrls(chainId, address);
  // }

  // Not used anywhere
  // async getByChainAndAddress(
  //   chainId: string,
  //   address: string
  // ): Promise<FileObject[]> {
  //   chainId = checkChainId(chainId);
  //   return this.fetchAllFileContents(chainId, address);
  // }

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
      const relativePath = file.path.split("/repository")[1].substr(1);
      urls.push(`${process.env.REPOSITORY_SERVER_URL}/${relativePath}`);
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
      `/contracts/${match}/${chain}/${toChecksumAddress(address)}/`;
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
      pathConfig.chain,
      toChecksumAddress(pathConfig.address)
    );
  }

  fetchCreate2Args(fullContractPath: string): Create2Args | undefined {
    try {
      return JSON.parse(
        fs.readFileSync(
          fullContractPath.replace("metadata.json", "create2-args.json"),
          "utf8"
        )
      );
    } catch (e) {
      return undefined;
    }
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
  ): { time: Date; status: Status; create2Args?: Create2Args } {
    if (fs.existsSync(fullContractPath)) {
      const create2Args = this.fetchCreate2Args(fullContractPath);
      return {
        time: fs.statSync(fullContractPath).birthtime,
        status: "perfect",
        create2Args,
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
  checkByChainAndAddress(address: string, chain: string): Match[] {
    const contractPath = this.generateAbsoluteFilePath({
      matchQuality: "full",
      chain,
      address,
      fileName: "metadata.json",
    });

    try {
      const storageTimestamp = fs.statSync(contractPath).birthtime;
      return [
        {
          address,
          chainId: chain,
          status: "perfect",
          storageTimestamp,
        },
      ];
    } catch (e: any) {
      const error = new Error("findByAddress: Address not found in repository");
      SourcifyEventManager.trigger("Verification.Error", {
        message: error.message,
        stack: e.stack,
        details: {
          address,
          chain,
        },
      });
      throw error;
    }
  }

  // Checks contract existence in repository for full and partial matches.
  checkAllByChainAndAddress(address: string, chain: string): Match[] {
    const fullContractPath = this.generateAbsoluteFilePath({
      matchQuality: "full",
      chain,
      address,
      fileName: "metadata.json",
    });

    const partialContractPath = this.generateAbsoluteFilePath({
      matchQuality: "partial",
      chain,
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
          chainId: chain,
          status: storage?.status,
          storageTimestamp: storage?.time,
          create2Args: storage?.create2Args,
        },
      ];
    } catch (e: any) {
      const error = new Error("Address not found in repository");
      SourcifyEventManager.trigger("Verification.Error", {
        message: error.message,
        stack: e.stack,
        details: {
          address,
          chain,
        },
      });
      throw error;
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
    this.updateRepositoryTag();
  }

  deletePartialIfExists(chain: string, address: string) {
    const pathConfig: PathConfig = {
      matchQuality: "partial",
      chain,
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
    const repositoryVersion = process.env.REPOSITORY_VERSION || "0.1";
    const tag: RepositoryTag = {
      timestamp: timestamp,
      repositoryVersion: repositoryVersion,
    };
    fs.writeFileSync(filePath, JSON.stringify(tag));
  }
}
