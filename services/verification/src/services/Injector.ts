import Web3 from "web3";
import * as bunyan from "bunyan";
import {
  Match,
  InputData,
  getSupportedChains,
  Logger,
  IFileService,
  FileService,
  StringMap,
  cborDecode,
  CheckedContract,
  MatchQuality,
  Chain,
  Status,
  Metadata,
} from "@ethereum-sourcify/core";
import {
  RecompilationResult,
  getBytecode,
  recompile,
  trimAuxdata,
  checkEndpoint,
  getCreationDataFromArchive,
  getCreationDataByScraping,
  getCreationDataFromGraphQL,
  getCreationDataTelos,
  getCreationDataXDC,
  getCreationDataMeter,
  getCreationDataAvalancheSubnet,
} from "../utils";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multihashes: any = require("multihashes");
import semverSatisfies from "semver/functions/satisfies";
import { create, IPFSHTTPClient, globSource } from "ipfs-http-client";
import path from "path";

export interface InjectorConfig {
  silent?: boolean;
  log?: bunyan;
  offline?: boolean;
  repositoryPath?: string;
  fileService?: IFileService;
  web3timeout?: number;
}

class InjectorChain {
  web3array: Web3[];
  rpc: string[];
  name: string;
  contractFetchAddress: string;
  graphQLFetchAddress: string;
  txRegex: string;
  // archiveWeb3: Web3;

  constructor(chain: Chain) {
    this.web3array = [];
    this.rpc = chain.rpc;
    this.name = chain.name;
    this.contractFetchAddress = chain.contractFetchAddress;
    this.graphQLFetchAddress = chain.graphQLFetchAddress;
    this.txRegex = chain.txRegex;
    // this.archiveWeb3 = chain.archiveWeb3;
  }
}

interface InjectorChainMap {
  [id: string]: InjectorChain;
}

class LoggerWrapper {
  logger: bunyan;
  logId: string;

  constructor(logger: bunyan) {
    this.logger = logger;
    this.logId = Math.random().toString().slice(2);
  }

  info(obj: any, ...params: any[]): void {
    return this.logger.info(
      Object.assign(obj, { verificationId: this.logId }),
      ...params
    );
  }

  error(obj: any, ...params: any[]): void {
    return this.logger.error(
      Object.assign(obj, { verificationId: this.logId }),
      ...params
    );
  }
}

export class Injector {
  private log: bunyan;
  private chains: InjectorChainMap;
  private offline: boolean;
  public fileService: IFileService;
  private web3timeout: number;
  repositoryPath: string;
  private ipfsClient: IPFSHTTPClient;

  /**
   * Constructor
   * @param {InjectorConfig = {}} config
   */
  private constructor(config: InjectorConfig = {}) {
    this.chains = {};
    this.offline = config.offline || false;
    this.repositoryPath = config.repositoryPath;
    this.log = config.log || Logger("Injector");
    this.web3timeout = config.web3timeout || 3000;

    this.fileService =
      config.fileService || new FileService(this.repositoryPath, this.log);
    this.ipfsClient = process.env.IPFS_API
      ? create({ url: process.env.IPFS_API })
      : undefined;
  }

  /**
   * Creates an instance of Injector. Waits for chains to initialize.
   * Await this method to work with an instance that has all chains initialized.
   * @param config
   */
  public static async createAsync(
    config: InjectorConfig = {}
  ): Promise<Injector> {
    const instance = new Injector(config);
    if (!instance.offline) {
      await instance.initChains();
    }
    return instance;
  }

  /**
   * Creates an instance of Injector. Does not initialize chains.
   * @param config
   */
  public static createOffline(config: InjectorConfig = {}): Injector {
    return new Injector(config);
  }

  /**
   * Instantiates a web3 provider for all supported Sourcify networks via their given RPCs.
   * If environment variable TESTING is set to true, localhost:8545 is also available.
   */
  private async initChains() {
    const chainsData = getSupportedChains();

    for (const chain of chainsData) {
      this.chains[chain.chainId] = new InjectorChain(chain);

      this.chains[chain.chainId].web3array = chain.rpc
        .filter((rpcURL: string) => !!rpcURL)
        .map((rpcURL: string) => {
          const opts = { timeout: this.web3timeout };
          const web3 = rpcURL.startsWith("http")
            ? new Web3(new Web3.providers.HttpProvider(rpcURL, opts))
            : new Web3(new Web3.providers.WebsocketProvider(rpcURL, opts));
          return web3;
        });
    }
  }

  /**
   * Searches a set of addresses for the one whose deployedBytecode
   * matches a given bytecode string
   * @param {String[]}          addresses
   * @param {string}      deployedBytecode
   */
  private async matchBytecodeToAddress(
    chain: string,
    addresses: string[] = [],
    recompiled: RecompilationResult,
    metadata: Metadata
  ): Promise<Match> {
    let match: Match = { address: null, status: null };
    const chainName = this.chains[chain].name || "The chain";

    for (let address of addresses) {
      address = Web3.utils.toChecksumAddress(address);

      let deployedBytecode: string | null = null;
      this.log.info(
        {
          loc: "[MATCH]",
          chain: chain,
          address: address,
        },
        `Retrieving contract bytecode address`
      );
      try {
        deployedBytecode = await getBytecode(
          this.chains[chain].web3array,
          address
        );
      } catch (err: any) {
        if (err?.errors?.length > 0)
          err.message = err.errors.map(
            (e: { message: string }) => e.message || e
          ); // Avoid uninformative message "All Promises Rejected"
        this.log.error(
          { loc: "[MATCH]", address, chain },
          err.message.toString()
        );
        throw err;
      }

      try {
        match = await this.compareBytecodes(
          deployedBytecode,
          null,
          recompiled,
          chain,
          address
        );
      } catch (err: any) {
        if (addresses.length === 1) {
          err?.message
            ? (match.message = err.message)
            : (match.message =
                "There were problems during contract verification. Please try again in a minute.");
        }
      }

      if (match.status) {
        break;
      } else if (addresses.length === 1 && !match.message) {
        if (!deployedBytecode) {
          match.message = `${chainName} is temporarily unavailable.`;
        } else if (deployedBytecode === "0x") {
          match.message = `${chainName} does not have a contract deployed at ${address}.`;
        }
        // Case when extra unused files in compiler input cause different bytecode (https://github.com/ethereum/sourcify/issues/618)
        else if (
          semverSatisfies(metadata.compiler.version, "=0.6.12 || =0.7.0") &&
          metadata.settings.optimizer.enabled
        ) {
          const deployedMetadataHash =
            this.getMetadataPathFromCborEncoded(deployedBytecode);
          const recompiledMetadataHash = this.getMetadataPathFromCborEncoded(
            recompiled.deployedBytecode
          );
          // Metadata hashes match but bytecodes don't match.
          if (deployedMetadataHash === recompiledMetadataHash) {
            match.status = "extra-file-input-bug";
            match.message =
              "It seems your contract has either Solidity v0.6.12 or v0.7.0, and the metadata hashes match but not the bytecodes. You should add all the files input the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618";
          } else {
            match.message = "The deployed and recompiled bytecode don't match.";
          }
        } else {
          match.message = "The deployed and recompiled bytecode don't match.";
        }
      }
    }

    return match;
  }

  /**
   * Returns a string description of how closely two bytecodes match. Bytecodes
   * that match in all respects apart from their metadata hashes are 'partial'.
   * Bytecodes that don't match are `null`.
   * @param  {string} deployedBytecode
   * @param  {string} creationData
   * @param  {string} compiledRuntimeBytecode
   * @param  {string} compiledCreationBytecode
   * @param  {string} chain chainId of the chain where contract is being checked
   * @param  {string} address contract address
   * @return {Match}  match description ('perfect'|'partial'|null) and possibly constructor args (ABI-encoded) and library links
   */
  private async compareBytecodes(
    deployedBytecode: string | null,
    creationData: string,
    recompiled: RecompilationResult,
    chain: string,
    address: string
  ): Promise<Match> {
    const match: Match = {
      address,
      status: null,
      encodedConstructorArgs: undefined,
      libraryMap: undefined,
    };

    if (deployedBytecode && deployedBytecode.length > 2) {
      const { replaced, libraryMap } = this.addLibraryAddresses(
        recompiled.deployedBytecode,
        deployedBytecode
      );
      recompiled.deployedBytecode = replaced;
      match.libraryMap = libraryMap;

      if (deployedBytecode === recompiled.deployedBytecode) {
        // if the bytecode doesn't contain metadata then "partial" match
        if (this.getMetadataPathFromCborEncoded(deployedBytecode) === null) {
          match.status = "partial";
          return match;
        }
        match.status = "perfect";
        return match;
      }

      const trimmedDeployedBytecode = trimAuxdata(deployedBytecode);
      const trimmedCompiledRuntimeBytecode = trimAuxdata(
        recompiled.deployedBytecode
      );
      if (trimmedDeployedBytecode === trimmedCompiledRuntimeBytecode) {
        match.status = "partial";
        return match;
      }

      if (
        trimmedDeployedBytecode.length === trimmedCompiledRuntimeBytecode.length
      ) {
        creationData =
          creationData || (await this.getCreationData(chain, address));

        const { replaced, libraryMap } = this.addLibraryAddresses(
          recompiled.creationBytecode,
          creationData
        );
        recompiled.creationBytecode = replaced;
        match.libraryMap = libraryMap;

        if (creationData) {
          if (creationData.startsWith(recompiled.creationBytecode)) {
            // The reason why this uses `startsWith` instead of `===` is that
            // creationData may contain constructor arguments at the end part.
            const encodedConstructorArgs = this.extractEncodedConstructorArgs(
              creationData,
              recompiled.creationBytecode
            );
            match.status = "perfect";
            match.encodedConstructorArgs = encodedConstructorArgs;
            return match;
          }

          const trimmedCompiledCreationBytecode = trimAuxdata(
            recompiled.creationBytecode
          );

          if (creationData.startsWith(trimmedCompiledCreationBytecode)) {
            match.status = "partial";
            return match;
          }
        }
      }
    }

    return match;
  }

  private addLibraryAddresses(
    template: string,
    real: string
  ): {
    replaced: string;
    libraryMap: StringMap;
  } {
    const PLACEHOLDER_START = "__$";
    const PLACEHOLDER_LENGTH = 40;

    const libraryMap: StringMap = {};

    let index = template.indexOf(PLACEHOLDER_START);
    for (; index !== -1; index = template.indexOf(PLACEHOLDER_START)) {
      const placeholder = template.slice(index, index + PLACEHOLDER_LENGTH);
      const address = real.slice(index, index + PLACEHOLDER_LENGTH);
      libraryMap[placeholder] = address;
      const regexCompatiblePlaceholder = placeholder
        .replace("__$", "__\\$")
        .replace("$__", "\\$__");
      const regex = RegExp(regexCompatiblePlaceholder, "g");
      template = template.replace(regex, address);
    }

    return {
      replaced: template,
      libraryMap,
    };
  }

  /**
   * Returns the `creationData` from the transaction that created the contract at the provided chain and address.
   * @param chain
   * @param contractAddress
   * @returns `creationData` if found, `null` otherwise
   */
  private async getCreationData(
    chain: string,
    contractAddress: string
  ): Promise<string> {
    const loc = "[GET_CREATION_DATA]";
    const txFetchAddress = this.chains[chain]?.contractFetchAddress.replace(
      "${ADDRESS}",
      contractAddress
    );
    const txRegex = this.chains[chain].txRegex;

    if (txFetchAddress && txRegex) {
      // fetch from a block explorer and extract by regex
      this.log.info(
        { loc, chain, contractAddress, fetchAddress: txFetchAddress },
        "Scraping block explorer"
      );
      for (const web3 of this.chains[chain].web3array) {
        try {
          return await getCreationDataByScraping(txFetchAddress, txRegex, web3);
        } catch (err: any) {
          this.log.error(
            { loc, chain, contractAddress, err: err.message },
            "Scraping failed!"
          );
        }
      }
    }

    // Telos
    if (txFetchAddress && (chain == "40" || chain == "41")) {
      for (const web3 of this.chains[chain].web3array) {
        this.log.info(
          { loc, chain, contractAddress, fetchAddress: txFetchAddress },
          "Querying Telos API"
        );
        try {
          return await getCreationDataTelos(txFetchAddress, web3);
        } catch (err: any) {
          this.log.error(
            { loc, chain, contractAddress, err: err.message },
            "Telos API failed!"
          );
        }
      }
    }
    if (txFetchAddress && (chain == "50" || chain == "51")) {
      for (const web3 of this.chains[chain].web3array) {
        this.log.info(
          { loc, chain, contractAddress, fetchAddress: txFetchAddress },
          "Querying BlocksScan API"
        );
        try {
          return await getCreationDataXDC(txFetchAddress, web3);
        } catch (err: any) {
          this.log.error(
            { loc, chain, contractAddress, err: err.message },
            "BlocksScan API failed!"
          );
        }
      }
    }

    // Meter network
    if (txFetchAddress && (chain == "83" || chain == "82")) {
      for (const web3 of this.chains[chain].web3array) {
        this.log.info(
          { loc, chain, contractAddress, fetchAddress: txFetchAddress },
          "Querying Meter API"
        );
        try {
          return await getCreationDataMeter(txFetchAddress, web3);
        } catch (err: any) {
          this.log.error(
            { loc, chain, contractAddress, err: err.message },
            "Meter API failed!"
          );
        }
      }
    }

    // Avalanche Subnets
    if (txFetchAddress && ["11111", "335", "53935", "432201"].includes(chain)) {
      for (const web3 of this.chains[chain].web3array) {
        this.log.info(
          { loc, chain, contractAddress, fetchAddress: txFetchAddress },
          "Querying Avalanche Subnet Explorer API"
        );
        try {
          return await getCreationDataAvalancheSubnet(txFetchAddress, web3);
        } catch (err: any) {
          this.log.error(
            { loc, chain, contractAddress, err: err.message },
            "Avalanche Subnet Explorer API failed!"
          );
        }
      }
    }

    const graphQLFetchAddress = this.chains[chain].graphQLFetchAddress;
    if (graphQLFetchAddress) {
      // fetch from graphql node
      for (const web3 of this.chains[chain].web3array) {
        try {
          return await getCreationDataFromGraphQL(
            graphQLFetchAddress,
            contractAddress,
            web3
          );
        } catch (err: any) {
          this.log.error({ loc, chain, contractAddress, err: err.message });
        }
      }
    }

    // Commented out for publishing chains in sourcify-chains at /chains endpoint. Also, since all chains with archiveWeb3 (Ethereum networks) already had txRegex and txFetchAddress, this block of code never executes.
    // const archiveWeb3 = this.chains[chain].archiveWeb3;
    // if (archiveWeb3) { // fetch by binary search on chain history
    //     this.log.info({ loc, chain, contractAddress }, "Fetching archive data");
    //     try {
    //         return await getCreationDataFromArchive(contractAddress, archiveWeb3);
    //     } catch(err: any) {
    //         this.log.error({ loc, chain, contractAddress, err: err.message }, "Archive search failed!");
    //     }
    // }

    const err = `Cannot fetch creation data via ${txFetchAddress} on chainId ${chain} of contract ${contractAddress}`;
    this.log.error({ loc, chain, contractAddress, err });
    throw new Error(err);
  }

  private extractEncodedConstructorArgs(
    creationData: string,
    compiledCreationBytecode: string
  ) {
    const startIndex = creationData.indexOf(compiledCreationBytecode);
    return (
      "0x" + creationData.slice(startIndex + compiledCreationBytecode.length)
    );
  }

  /**
   * Throws if addresses array contains a null value (express) or is length 0
   * @param {string[] = []} addresses param (submitted to injector)
   */
  private validateAddresses(addresses: string[] = []) {
    const err = new Error("Missing address for submitted sources/metadata");

    if (!addresses.length) {
      throw err;
    }

    for (const address of addresses) {
      if (address == null) throw err;
    }
  }

  /**
   * Throws if `chain` is falsy or wrong type
   * @param {string} chain param (submitted to injector)
   */
  private validateChain(chain: string) {
    if (!chain || typeof chain !== "string") {
      throw new Error("Missing chain for submitted sources/metadata");
    }
  }

  /**
   * Used by the front-end. Accepts a set of source files and a metadata string,
   * recompiles / validates them and stores them in the repository by chain/address
   * and by swarm | ipfs hash.
   * @param  {string}            repository repository root (ex: 'repository')
   * @param  {string}            chain      chain name (ex: 'ropsten')
   * @param  {string}            address    contract address
   * @param  {string[]}          files
   * @return {Promise<object>}              address & status of successfully verified contract
   */
  public async inject(inputData: InputData): Promise<Match> {
    const { chain, addresses, contract } = inputData;
    this.validateAddresses(addresses);
    this.validateChain(chain);

    let match: Match;
    const wrappedLogger = new LoggerWrapper(this.log);

    if (!CheckedContract.isValid(contract)) {
      await CheckedContract.fetchMissing(contract, wrappedLogger);
    }

    const compilationResult = await recompile(
      contract.metadata,
      contract.solidity,
      wrappedLogger
    );

    // When injector is called by monitor, the bytecode has already been
    // obtained for address and we only need to compare w/ compilation result.
    if (inputData.bytecode) {
      if (addresses.length !== 1) {
        const err =
          "Injector cannot work with multiple addresses if bytecode is provided";
        this.log.error({ loc: "[INJECTOR]", addresses, err });
        throw new Error(err);
      }
      const address = Web3.utils.toChecksumAddress(addresses[0]);

      match = await this.compareBytecodes(
        inputData.bytecode,
        inputData.creationData,
        compilationResult,
        chain,
        address
      );

      // For other cases, we need to retrieve the code for specified address
      // from the chain.
    } else {
      match = await this.matchBytecodeToAddress(
        chain,
        addresses,
        compilationResult,
        contract.metadata
      );
    }

    if (
      match.address &&
      (match.status === "perfect" || match.status === "partial")
    ) {
      // Delete the partial matches if we now have a perfect match instead.
      if (match.status === "perfect") {
        this.fileService.deletePartialIfExists(chain, match.address);
      }
      const matchQuality = this.statusToMatchQuality(match.status);
      this.storeSources(matchQuality, chain, match.address, contract.solidity);
      this.storeMetadata(matchQuality, chain, match.address, compilationResult);

      if (match.encodedConstructorArgs && match.encodedConstructorArgs.length) {
        this.storeConstructorArgs(
          matchQuality,
          chain,
          match.address,
          match.encodedConstructorArgs
        );
      }

      if (match.libraryMap && Object.keys(match.libraryMap).length) {
        this.storeLibraryMap(
          matchQuality,
          chain,
          match.address,
          match.libraryMap
        );
      }

      if (this.ipfsClient) {
        this.addToIpfsMfs(matchQuality, chain, match.address);
      }
    } else if (match.status === "extra-file-input-bug") {
      return match;
    } else {
      const message =
        match.message ||
        "Could not match the deployed and recompiled bytecode.";
      const err = new Error(`Contract name: ${contract.name}. ${message}`);

      this.log.error({
        loc: "[INJECT]",
        chain,
        addresses,
        err,
      });

      throw new Error(err.message);
    }

    return match;
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
  }

  private sanitizePath(originalPath: string): string {
    return originalPath
      .replace(/[^a-z0-9_./-]/gim, "_")
      .replace(/(^|\/)[.]+($|\/)/, "_");
  }

  private getMetadataPathFromCborEncoded(
    bytecode: string,
    address?: string,
    chain?: string
  ) {
    const bytes = Web3.utils.hexToBytes(bytecode);
    const cborData = cborDecode(bytes);

    if (cborData["bzzr0"]) {
      return `/swarm/bzzr0/${Web3.utils
        .bytesToHex(cborData["bzzr0"])
        .slice(2)}`;
    } else if (cborData["bzzr1"]) {
      return `/swarm/bzzr1/${Web3.utils
        .bytesToHex(cborData["bzzr1"])
        .slice(2)}`;
    } else if (cborData["ipfs"]) {
      return `/ipfs/${multihashes.toB58String(cborData["ipfs"])}`;
    }

    this.log.error({
      loc: "[INJECTOR:GET_METADATA_PATH]",
      address,
      chain,
      err: "No metadata hash in cbor encoded data.",
    });
    return null;
  }

  /**
   * Stores the metadata from compilationResult to the swarm | ipfs subrepo. The exact storage path depends
   * on the swarm | ipfs address extracted from compilationResult.deployedByteode.
   *
   * @param chain used only for logging
   * @param address used only for loggin
   * @param compilationResult should contain deployedBytecode and metadata
   */
  private storeMetadata(
    matchQuality: MatchQuality,
    chain: string,
    address: string,
    compilationResult: RecompilationResult
  ) {
    this.fileService.save(
      {
        matchQuality,
        chain,
        address,
        fileName: "metadata.json",
      },
      compilationResult.metadata
    );
  }

  /**
   * Writes the verified sources (.sol files) to the repository.
   * @param {string}              chain             chain name (ex: 'ropsten')
   * @param {string}              address           contract address
   * @param {StringMap}           sources           'rearranged' sources
   * @param {MatchQuality}        matchQuality
   */
  private storeSources(
    matchQuality: MatchQuality,
    chain: string,
    address: string,
    sources: StringMap
  ) {
    for (const sourcePath in sources) {
      this.fileService.save(
        {
          matchQuality,
          chain,
          address,
          source: true,
          fileName: this.sanitizePath(sourcePath),
        },
        sources[sourcePath]
      );
    }
  }

  /**
   * Writes the constructor arguments to the repository.
   * @param matchQuality
   * @param chain
   * @param address
   * @param encodedConstructorArgs
   */
  private storeConstructorArgs(
    matchQuality: MatchQuality,
    chain: string,
    address: string,
    encodedConstructorArgs: string
  ) {
    this.fileService.save(
      {
        matchQuality,
        chain,
        address,
        source: false,
        fileName: "constructor-args.txt",
      },
      encodedConstructorArgs
    );
  }

  /**
   * Writes the map of library links (pairs of the format <placeholder:address>) to the repository.
   * @param matchQuality
   * @param chain
   * @param address
   * @param libraryMap
   */
  private storeLibraryMap(
    matchQuality: MatchQuality,
    chain: string,
    address: string,
    libraryMap: StringMap
  ) {
    const indentationSpaces = 2;
    this.fileService.save(
      {
        matchQuality,
        chain,
        address,
        source: false,
        fileName: "library-map.json",
      },
      JSON.stringify(libraryMap, null, indentationSpaces)
    );
  }

  /**
   * Adds the verified contract's folder to IPFS via MFS
   *
   * @param matchQuality
   * @param chain
   * @param address
   */
  private async addToIpfsMfs(
    matchQuality: MatchQuality,
    chain: string,
    address: string
  ) {
    const contractFolderDir = this.fileService.generateAbsoluteFilePath({
      matchQuality,
      chain,
      address,
    });
    const ipfsMFSDir =
      "/" +
      this.fileService.generateRelativeContractDir({
        matchQuality,
        chain,
        address,
      });
    const filesAsyncIterable = globSource(contractFolderDir, "**/*");
    for await (const file of filesAsyncIterable) {
      if (!file.content) continue; // skip directories
      const mfsPath = path.join(ipfsMFSDir, file.path);
      await this.ipfsClient.files.mkdir(path.dirname(mfsPath), {
        parents: true,
      });
      // Readstream to Buffers
      const chunks: Buffer[] = [];
      for await (const chunk of file.content) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      await this.ipfsClient.files.write(mfsPath, fileBuffer, { create: true });
    }
  }
}
