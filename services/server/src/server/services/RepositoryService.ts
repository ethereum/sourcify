import dirTree from "directory-tree";
import Path from "path";
import fs from "fs";
import {
  Match,
  Status,
  Create2Args,
  StringMap,
  /* ContextVariables, */
  CheckedContract,
  Transformation,
} from "@ethereum-sourcify/lib-sourcify";
import { MatchLevel, RepositoryTag } from "../types";
import {
  create as createIpfsClient,
  IPFSHTTPClient,
  globSource,
} from "ipfs-http-client";
import path from "path";
import { SourcifyEventManager } from "../../common/SourcifyEventManager/SourcifyEventManager";
import { logger } from "../../common/loggerLoki";
import { getAddress } from "ethers";
import { id as keccak256str } from "ethers";
import * as AllianceDatabase from "./utils/alliance-database-util";
import { getMatchStatus } from "../common";

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
  storeMatch(contract: CheckedContract, match: Match): Promise<void | Match>;
}

export class RepositoryService implements IRepositoryService {
  repositoryPath: string;
  private ipfsClient?: IPFSHTTPClient;
  private allianceDatabasePool?: any;

  constructor(repositoryPath: string) {
    this.repositoryPath = repositoryPath;
    if (process.env.IPFS_API) {
      this.ipfsClient = createIpfsClient({ url: process.env.IPFS_API });
    } else {
      logger.warn("IPFS_API not set, IPFS MFS will not be updated");
    }
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
      const relativePath =
        "contracts/" + file.path.split("/contracts")[1].substr(1);
      // TODO: Don't use REPOSITORY_SERVER_URL but a relative URL to the server. Requires a breaking chage to the API
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
  checkByChainAndAddress(address: string, chainId: string): Match[] {
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
        `Contract (full_match) not found in repository: ${address} - chain: ${chainId}`
      );
      return [];
    }
  }

  // Checks contract existence in repository for full and partial matches.
  checkAllByChainAndAddress(address: string, chainId: string): Match[] {
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
          create2Args: storage?.create2Args,
        },
      ];
    } catch (e: any) {
      logger.debug(
        `Contract (full & partial match) not found in repository: ${address} - chain: ${chainId}`
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

      /* if (
        match.contextVariables &&
        Object.keys(match.contextVariables).length > 0
      ) {
        this.storeJSON(
          matchQuality,
          match.chainId,
          match.address,
          "context-variables.json",
          match.contextVariables
        );
      } */

      if (match.creatorTxHash) {
        this.storeTxt(
          matchQuality,
          match.chainId,
          match.address,
          "creator-tx-hash.txt",
          match.creatorTxHash
        );
      }

      if (match.create2Args) {
        this.storeJSON(
          matchQuality,
          match.chainId,
          match.address,
          "create2-args.json",
          match.create2Args
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

      await this.addToIpfsMfs(matchQuality, match.chainId, match.address);
      // await this.addToAllianceDatabase(contract, match);
      SourcifyEventManager.trigger("Verification.MatchStored", match);
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
    const repositoryVersion = process.env.REPOSITORY_VERSION || "0.1";
    const tag: RepositoryTag = {
      timestamp: timestamp,
      repositoryVersion: repositoryVersion,
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
    const pathTranslation: StringMap = {};
    for (const sourcePath in sources) {
      const { sanitizedPath, originalPath } = this.sanitizePath(sourcePath);
      if (sanitizedPath !== originalPath) {
        pathTranslation[originalPath] = sanitizedPath;
      }
      this.save(
        {
          matchQuality,
          chainId,
          address,
          source: true,
          fileName: sanitizedPath,
        },
        sources[sourcePath]
      );
    }
    // Finally save the path translation
    if (Object.keys(pathTranslation).length === 0) return;
    this.save(
      {
        matchQuality,
        chainId,
        address,
        source: false,
        fileName: "path-translation.json",
      },
      JSON.stringify(pathTranslation)
    );
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
  }
  private sanitizePath(originalPath: string) {
    // Clean ../ and ./ from the path. Also collapse multiple slashes into one.
    let sanitizedPath = path.normalize(originalPath);

    // If there are no upper folders to traverse, path.normalize will keep ../ parts. Need to remove any of those.
    const parsedPath = path.parse(sanitizedPath);
    const sanitizedDir = parsedPath.dir
      .split(path.sep)
      .filter((segment) => segment !== "..")
      .join(path.sep);

    // Force absolute paths to be relative
    if (parsedPath.root) {
      parsedPath.dir = sanitizedDir.slice(parsedPath.root.length);
      parsedPath.root = "";
    } else {
      parsedPath.dir = sanitizedDir;
    }

    sanitizedPath = path.format(parsedPath);
    return { sanitizedPath, originalPath };
  }

  async initAllianceDatabase(): Promise<boolean> {
    // if the database is already initialized
    if (this.allianceDatabasePool != undefined) {
      return true;
    }

    try {
      this.allianceDatabasePool = await AllianceDatabase.getPool();
      return true;
    } catch (e) {
      logger.error(e);
      return false;
    }
  }

  private async addToAllianceDatabase(
    recompiledContract: CheckedContract,
    match: Match
  ) {
    if (
      recompiledContract.runtimeBytecode === undefined ||
      recompiledContract.creationBytecode === undefined ||
      match.onchainRuntimeBytecode === undefined ||
      match.onchainCreationBytecode === undefined
    ) {
      // Can only store contracts with both runtimeBytecode and creationBytecode
      return;
    }

    if (match.creatorTxHash === undefined) {
      // Can only store matches with creatorTxHash
      return;
    }

    if (!(await this.initAllianceDatabase())) {
      logger.warn(
        "Cannot initialize AllianceDatabase, the database will not be updated"
      );
      return;
    }

    const keccak256OnchainCreationBytecode = keccak256str(
      match.onchainCreationBytecode
    );
    const keccak256OnchainRuntimeBytecode = keccak256str(
      match.onchainRuntimeBytecode
    );

    const keccak256RecompiledCreationBytecode = keccak256str(
      recompiledContract.creationBytecode
    );
    const keccak256RecompiledRuntimeBytecode = keccak256str(
      recompiledContract.runtimeBytecode
    );

    // Get all the verified contracts existing in the Database for these exact onchain bytecodes.
    const existingVerifiedContractResult =
      await AllianceDatabase.getVerifiedContractByBytecodeHashes(
        this.allianceDatabasePool,
        keccak256OnchainRuntimeBytecode,
        keccak256OnchainCreationBytecode
      );

    const {
      runtimeTransformations,
      runtimeTransformationValues,
      creationTransformations,
      creationTransformationValues,
    } = match;
    const compilationTargetPath = Object.keys(
      recompiledContract.metadata.settings.compilationTarget
    )[0];
    const compilationTargetName = Object.values(
      recompiledContract.metadata.settings.compilationTarget
    )[0];
    const language = "solidity";
    const compilerOutput =
      recompiledContract.compilerOutput?.contracts[
        recompiledContract.compiledPath
      ][recompiledContract.name];

    if (!(await recompiledContract.generateArtifacts())) {
      logger.warn(
        `Cannot generate contract artifacts for: ${recompiledContract.name} with address ${match.address} on chain ${match.chainId}`
      );
      return;
    }

    const compilationArtifacts = {
      abi: compilerOutput?.abi || {},
      userdoc: compilerOutput?.userdoc || {},
      devdoc: compilerOutput?.devdoc || {},
      storageLayout: compilerOutput?.storageLayout || {},
    };
    const creationCodeArtifacts = {
      sourceMap: compilerOutput?.evm.bytecode.sourceMap || "",
      linkReferences: compilerOutput?.evm.bytecode.linkReferences || {},
      cborAuxdata: recompiledContract?.artifacts?.creationBytecodeCborAuxdata,
    };
    const runtimeCodeArtifacts = {
      sourceMap: compilerOutput?.evm.deployedBytecode?.sourceMap || "",
      linkReferences:
        compilerOutput?.evm.deployedBytecode?.linkReferences || {},
      immutableReferences:
        compilerOutput?.evm.deployedBytecode?.immutableReferences || {},
      cborAuxdata: recompiledContract?.artifacts?.runtimeBytecodeCborAuxdata,
    };

    const runtimeMatch =
      match.runtimeMatch === "perfect" || match.runtimeMatch === "partial";
    const creationMatch =
      match.creationMatch === "perfect" || match.creationMatch === "partial";

    if (existingVerifiedContractResult.rows.length === 0) {
      try {
        // Add recompiled bytecodes
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256RecompiledCreationBytecode,
          bytecode: recompiledContract.creationBytecode,
        });
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256RecompiledRuntimeBytecode,
          bytecode: recompiledContract.runtimeBytecode,
        });

        // Add deployed bytecodes
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256OnchainCreationBytecode,
          bytecode: match.onchainCreationBytecode,
        });
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256OnchainRuntimeBytecode,
          bytecode: match.onchainRuntimeBytecode,
        });

        // Add the onchain contract in contracts
        const contractInsertResult = await AllianceDatabase.insertContract(
          this.allianceDatabasePool,
          {
            creationBytecodeHash: keccak256OnchainCreationBytecode,
            runtimeBytecodeHash: keccak256OnchainRuntimeBytecode,
          }
        );

        // add the onchain contract in contract_deployments
        await AllianceDatabase.insertContractDeployment(
          this.allianceDatabasePool,
          {
            chainId: match.chainId,
            address: match.address,
            transactionHash: match.creatorTxHash,
            contractId: contractInsertResult.rows[0].id,
          }
        );

        // insert new recompiled contract
        const compiledContractsInsertResult =
          await AllianceDatabase.insertCompiledContract(
            this.allianceDatabasePool,
            {
              compiler: recompiledContract.compiledPath,
              version: recompiledContract.compilerVersion,
              language,
              name: recompiledContract.name,
              fullyQualifiedName: `${compilationTargetPath}:${compilationTargetName}`,
              compilationArtifacts,
              sources: recompiledContract.solidity,
              compilerSettings: recompiledContract.metadata.settings,
              creationCodeHash: keccak256RecompiledCreationBytecode,
              runtimeCodeHash: keccak256RecompiledRuntimeBytecode,
              creationCodeArtifacts,
              runtimeCodeArtifacts,
            }
          );

        // insert new recompiled contract with newly added contract and compiledContract
        await AllianceDatabase.insertVerifiedContract(
          this.allianceDatabasePool,
          {
            compilationId: compiledContractsInsertResult.rows[0].id,
            contractId: contractInsertResult.rows[0].id,
            creationTransformations: JSON.stringify(creationTransformations),
            creationTransformationValues: creationTransformationValues || {},
            runtimeTransformations: JSON.stringify(runtimeTransformations),
            runtimeTransformationValues: runtimeTransformationValues || {},
            runtimeMatch,
            creationMatch,
          }
        );
      } catch (e) {
        logger.error(
          `Cannot insert verified_contract:\n${JSON.stringify({ match })}\n${e}`
        );
        return;
      }
    } else {
      // Until the Alliance will decide a standard process to update:
      // if we have a "better match" always insert
      // "better match" = creation_transformations or runtime_transformations is better

      let needRuntimeMatchUpdate = false;
      let needCreationMatchUpdate = false;

      const existingCompiledContractIds: string[] = [];

      existingVerifiedContractResult.rows.forEach(
        (existingVerifiedContract) => {
          existingCompiledContractIds.push(
            existingVerifiedContract.compilation_id
          );
          const hasRuntimeAuxdataTransformation =
            existingVerifiedContract.runtime_transformations.some(
              (trans: Transformation) => trans.reason === "auxdata"
            );
          const hasCreationAuxdataTransformation =
            existingVerifiedContract.creation_transformations.some(
              (trans: Transformation) => trans.reason === "auxdata"
            );

          if (
            (hasRuntimeAuxdataTransformation &&
              match.runtimeMatch === "perfect") ||
            (existingVerifiedContract.runtime_match === false &&
              (match.runtimeMatch === "perfect" ||
                match.runtimeMatch === "partial"))
          ) {
            needRuntimeMatchUpdate = true;
          }

          if (
            (hasCreationAuxdataTransformation &&
              match.creationMatch === "perfect") ||
            (existingVerifiedContract.creation_match === false &&
              (match.creationMatch === "perfect" ||
                match.creationMatch === "partial"))
          ) {
            needCreationMatchUpdate = true;
          }
        }
      );

      if (needRuntimeMatchUpdate || needCreationMatchUpdate) {
        try {
          // Add recompiled bytecodes
          await AllianceDatabase.insertCode(this.allianceDatabasePool, {
            bytecodeHash: keccak256RecompiledCreationBytecode,
            bytecode: recompiledContract.creationBytecode,
          });
          await AllianceDatabase.insertCode(this.allianceDatabasePool, {
            bytecodeHash: keccak256RecompiledRuntimeBytecode,
            bytecode: recompiledContract.runtimeBytecode,
          });

          // insert new recompiled contract
          const compiledContractsInsertResult =
            await AllianceDatabase.insertCompiledContract(
              this.allianceDatabasePool,
              {
                compiler: recompiledContract.compiledPath,
                version: recompiledContract.compilerVersion,
                language,
                name: recompiledContract.name,
                fullyQualifiedName: `${compilationTargetPath}:${compilationTargetName}`,
                compilationArtifacts,
                sources: recompiledContract.solidity,
                compilerSettings: recompiledContract.metadata.settings,
                creationCodeHash: keccak256RecompiledCreationBytecode,
                runtimeCodeHash: keccak256RecompiledRuntimeBytecode,
                creationCodeArtifacts,
                runtimeCodeArtifacts,
              }
            );

          // Check if we are trying to insert a compiled contract that already exists
          // It could happen because of the check "needRuntimeMatchUpdate || needCreationMatchUpdate"
          // When the Alliance will decide a standard process to update this check will be removed
          if (
            existingCompiledContractIds.includes(
              compiledContractsInsertResult.rows[0].id
            )
          ) {
            return;
          }

          // update verified contract with the newly added recompiled contract
          await AllianceDatabase.insertVerifiedContract(
            this.allianceDatabasePool,
            {
              compilationId: compiledContractsInsertResult.rows[0].id,
              contractId: existingVerifiedContractResult.rows[0].contract_id,
              creationTransformations: JSON.stringify(creationTransformations),
              creationTransformationValues: creationTransformationValues || {},
              runtimeTransformations: JSON.stringify(runtimeTransformations),
              runtimeTransformationValues: runtimeTransformationValues || {},
              runtimeMatch,
              creationMatch,
            }
          );
        } catch (e) {
          logger.error(
            `Cannot update verified_contract:\n${JSON.stringify({
              match,
            })}\n${e}`
          );
          return;
        }
      }
    }
  }
}
