import Web3 from "web3";
import {
  Match,
  InjectorInput,
  getSupportedChains,
  IFileService,
  FileService,
  StringMap,
  CheckedContract,
  MatchQuality,
  Chain,
  Status,
  Metadata,
  Create2Args,
  Create2ConstructorArgument,
  SourcifyEventManager,
} from "@ethereum-sourcify/core";
import {
  RecompilationResult,
  getBytecode,
  recompile,
  checkEndpoint,
  getCreationDataFromArchive,
  getCreationDataByScraping,
  getCreationDataFromGraphQL,
  getCreationDataTelos,
  getCreationDataXDC,
  getCreationDataMeter,
  getCreationDataAvalancheSubnet,
  getCreate2Address,
} from "../utils";
import {
  decode as bytecodeDecode,
  splitAuxdata,
} from "@ethereum-sourcify/bytecode-utils";
import semverSatisfies from "semver/functions/satisfies";
import {
  create as createIpfsClient,
  IPFSHTTPClient,
  globSource,
} from "ipfs-http-client";
import path from "path";

export interface InjectorConfig {
  silent?: boolean;
  offline?: boolean;
  repositoryPath: string;
  fileService?: IFileService;
  web3timeout?: number;
}

class InjectorChain {
  web3array: Web3[];
  rpc: string[];
  name: string;
  contractFetchAddress?: string;
  graphQLFetchAddress?: string;
  txRegex?: string;
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

export class Injector {
  private chains: InjectorChainMap;
  private offline: boolean;
  public fileService: IFileService;
  private web3timeout: number;
  repositoryPath: string;
  private ipfsClient?: IPFSHTTPClient;

  /**
   * Constructor
   * @param {InjectorConfig = {}} config
   */
  private constructor(config: InjectorConfig) {
    this.chains = {};
    this.offline = config.offline || false;
    this.repositoryPath = config.repositoryPath;
    this.web3timeout = config.web3timeout || 3000;

    this.fileService =
      config.fileService || new FileService(this.repositoryPath);
    if (process.env.IPFS_API) {
      this.ipfsClient = createIpfsClient({ url: process.env.IPFS_API });
    } else {
      SourcifyEventManager.trigger("Verification.Error", {
        message: "IPFS_API not set. Files will not be pinned to IPFS.",
      });
    }
  }

  /**
   * Creates an instance of Injector. Waits for chains to initialize.
   * Await this method to work with an instance that has all chains initialized.
   * @param config
   */
  public static async createAsync(config: InjectorConfig): Promise<Injector> {
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
  public static createOffline(config: InjectorConfig): Injector {
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
    let match: Match = { address: addresses[0], chainId: chain, status: null };
    const chainName = this.chains[chain].name || "The chain";

    for (let address of addresses) {
      address = Web3.utils.toChecksumAddress(address);

      let deployedBytecode: string | null = null;
      try {
        deployedBytecode = await getBytecode(
          this.chains[chain].web3array,
          address
        );
      } catch (err: any) {
        SourcifyEventManager.trigger("Verification.Error", {
          message: err.message,
          stack: err.stack,
          details: err?.errors,
        });
        throw err;
      }

      try {
        match = await this.compareBytecodes(
          deployedBytecode,
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
          metadata.settings.optimizer?.enabled
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
    recompiled: RecompilationResult,
    chain: string,
    address: string,
    creationData?: string
  ): Promise<Match> {
    const match: Match = {
      address,
      chainId: chain,
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
        } else {
          match.status = "perfect";
        }
      } else {
        const [trimmedDeployedBytecode] = splitAuxdata(deployedBytecode);
        const [trimmedCompiledRuntimeBytecode] = splitAuxdata(
          recompiled.deployedBytecode
        );
        if (trimmedDeployedBytecode === trimmedCompiledRuntimeBytecode) {
          match.status = "partial";
        } else if (
          trimmedDeployedBytecode.length ===
          trimmedCompiledRuntimeBytecode.length
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
            } else {
              const [trimmedCompiledCreationBytecode] = splitAuxdata(
                recompiled.creationBytecode
              );

              if (creationData.startsWith(trimmedCompiledCreationBytecode)) {
                match.status = "partial";
              }
            }
          }
        }
      }
    }
    SourcifyEventManager.trigger("Verification.MatchCompared", {
      deployedBytecode,
      recompiled,
      chain,
      address,
      creationData,
      match,
    });
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
    const txFetchAddress = this.chains[chain]?.contractFetchAddress?.replace(
      "${ADDRESS}",
      contractAddress
    );
    const txRegex = this.chains[chain].txRegex;

    let creationData: false | string = false;
    if (txFetchAddress && txRegex) {
      // fetch from a block explorer and extract by regex
      for (const web3 of this.chains[chain].web3array) {
        try {
          creationData = await getCreationDataByScraping(
            txFetchAddress,
            txRegex,
            web3
          );
          break;
        } catch (err: any) {
          // Error catched later
        }
      }
    }

    // Telos
    if (txFetchAddress && (chain == "40" || chain == "41")) {
      for (const web3 of this.chains[chain].web3array) {
        try {
          creationData = await getCreationDataTelos(txFetchAddress, web3);
          break;
        } catch (err: any) {
          // Error catched later
        }
      }
    }
    if (txFetchAddress && (chain == "50" || chain == "51")) {
      for (const web3 of this.chains[chain].web3array) {
        try {
          creationData = await getCreationDataXDC(txFetchAddress, web3);
          break;
        } catch (err: any) {
          // Error catched later
        }
      }
    }

    // Meter network
    if (txFetchAddress && (chain == "83" || chain == "82")) {
      for (const web3 of this.chains[chain].web3array) {
        try {
          creationData = await getCreationDataMeter(txFetchAddress, web3);
          break;
        } catch (err: any) {
          // Error catched later
        }
      }
    }

    // Avalanche Subnets
    if (txFetchAddress && ["11111", "335", "53935", "432201"].includes(chain)) {
      for (const web3 of this.chains[chain].web3array) {
        try {
          creationData = await getCreationDataAvalancheSubnet(
            txFetchAddress,
            web3
          );
          break;
        } catch (err: any) {
          // Error catched later
        }
      }
    }

    const graphQLFetchAddress = this.chains[chain].graphQLFetchAddress;
    if (graphQLFetchAddress) {
      // fetch from graphql node
      for (const web3 of this.chains[chain].web3array) {
        try {
          creationData = await getCreationDataFromGraphQL(
            graphQLFetchAddress,
            contractAddress,
            web3
          );
          break;
        } catch (err: any) {
          // Error catched later
        }
      }
    }

    // Commented out for publishing chains in sourcify-chains at /chains endpoint. Also, since all chains with archiveWeb3 (Ethereum networks) already had txRegex and txFetchAddress, this block of code never executes.
    // const archiveWeb3 = this.chains[chain].archiveWeb3;
    // if (archiveWeb3) { // fetch by binary search on chain history
    //     try {
    //         return await getCreationDataFromArchive(contractAddress, archiveWeb3);
    //     } catch(err: any) {
    //     }
    // }

    if (creationData) {
      SourcifyEventManager.trigger("Verification.CreationBytecodeFetched", {
        chain,
        address: contractAddress,
        creationBytecode: creationData,
        txFetchAddress,
      });
      return creationData;
    } else {
      const error = new Error(
        `Cannot fetch creation data via ${txFetchAddress} on chainId ${chain} of contract ${contractAddress}`
      );
      SourcifyEventManager.trigger("Verification.Error", {
        message: error.message,
        details: {
          chain,
          contractAddress,
          txFetchAddress,
        },
      });
      throw error;
    }
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

  public async storeMatch(
    contract: CheckedContract,
    compilationResult: RecompilationResult,
    match: Match
  ) {
    if (
      match.address &&
      (match.status === "perfect" || match.status === "partial")
    ) {
      // Delete the partial matches if we now have a perfect match instead.
      if (match.status === "perfect") {
        this.fileService.deletePartialIfExists(match.chainId, match.address);
      }
      const matchQuality = this.statusToMatchQuality(match.status);
      this.storeSources(
        matchQuality,
        match.chainId,
        match.address,
        contract.solidity
      );
      this.storeMetadata(
        matchQuality,
        match.chainId,
        match.address,
        compilationResult
      );

      if (match.encodedConstructorArgs && match.encodedConstructorArgs.length) {
        this.storeConstructorArgs(
          matchQuality,
          match.chainId,
          match.address,
          match.encodedConstructorArgs
        );
      }

      if (match.create2Args) {
        this.storeCreate2Args(
          matchQuality,
          match.chainId,
          match.address,
          match.create2Args
        );
      }

      if (match.libraryMap && Object.keys(match.libraryMap).length) {
        this.storeLibraryMap(
          matchQuality,
          match.chainId,
          match.address,
          match.libraryMap
        );
      }

      await this.addToIpfsMfs(matchQuality, match.chainId, match.address);
      SourcifyEventManager.trigger("Verification.MatchStored", match);
    } else if (match.status === "extra-file-input-bug") {
      return match;
    } else {
      const message =
        match.message ||
        "Could not match the deployed and recompiled bytecode.";
      const err = new Error(`Contract name: ${contract.name}. ${message}`);
      SourcifyEventManager.trigger("Verification.Error", {
        message: err.message,
        stack: err.stack,
        details: {
          chain: match.chainId,
          address: match.address,
        },
      });
      throw err;
    }
  }

  /**
   * Recompiles a checked contract returning
   * @param  {CheckedContract} contract the checked contract to recompile
   * @return {Promise<object>} creationBytecode & deployedBytecode & metadata of successfully recompiled contract
   */
  public async recompile(contract: CheckedContract): Promise<any> {
    if (!CheckedContract.isValid(contract)) {
      await CheckedContract.fetchMissing(contract);
    }

    return await recompile(contract.metadata, contract.solidity);
  }

  public async getBytecode(address: string, chainId: string): Promise<any> {
    return await getBytecode(this.chains[chainId].web3array, address);
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
  public async inject(injectorInput: InjectorInput): Promise<Match> {
    const { chain, addresses, contract } = injectorInput;
    this.validateAddresses(addresses);
    this.validateChain(chain);

    let match: Match;

    if (!CheckedContract.isValid(contract)) {
      await CheckedContract.fetchMissing(contract);
    }

    const compilationResult = await recompile(
      contract.metadata,
      contract.solidity
    );

    // When injector is called by monitor, the bytecode has already been
    // obtained for address and we only need to compare w/ compilation result.
    if (injectorInput.bytecode) {
      if (addresses.length !== 1) {
        const err =
          "Injector cannot work with multiple addresses if bytecode is provided";
        const error = new Error(err);
        SourcifyEventManager.trigger("Verification.Error", {
          message: error.message,
          stack: error.stack,
          details: {
            addresses,
          },
        });
        throw error;
      }
      const address = Web3.utils.toChecksumAddress(addresses[0]);

      match = await this.compareBytecodes(
        injectorInput.bytecode,
        compilationResult,
        chain,
        address,
        injectorInput.creationData
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

    await this.storeMatch(contract, compilationResult, match);

    return match;
  }

  public async verifyCreate2(
    contract: CheckedContract,
    deployerAddress: string,
    salt: string,
    constructorArgs: Create2ConstructorArgument[],
    create2Address: string
  ): Promise<Match> {
    if (!CheckedContract.isValid(contract)) {
      await CheckedContract.fetchMissing(contract);
    }

    const constructorArgsTypes = constructorArgs.map(
      (arg: Create2ConstructorArgument) => arg.type
    );
    const constructorArgsValues = constructorArgs.map(
      (arg: Create2ConstructorArgument) => arg.value
    );

    const compilationResult = await recompile(
      contract.metadata,
      contract.solidity
    );

    const computedAddr = getCreate2Address({
      factoryAddress: deployerAddress,
      salt,
      contractBytecode: compilationResult.creationBytecode,
      constructorTypes: constructorArgsTypes,
      constructorArgs: constructorArgsValues,
    });

    if (create2Address !== computedAddr) {
      throw new Error(
        `The provided create2 address doesn't match server's generated one. Expected: ${computedAddr} ; Received: ${create2Address} ;`
      );
    }

    const encodedConstructorArgs = this.extractEncodedConstructorArgs(
      compilationResult.creationBytecode,
      compilationResult.deployedBytecode
    );

    const { libraryMap } = this.addLibraryAddresses(
      compilationResult.deployedBytecode,
      compilationResult.deployedBytecode
    );

    const create2Args: Create2Args = {
      deployerAddress,
      salt,
      constructorArgs,
    };

    const match: Match = {
      address: computedAddr,
      chainId: "0",
      status: "perfect",
      storageTimestamp: new Date(),
      encodedConstructorArgs: encodedConstructorArgs,
      create2Args,
      libraryMap: libraryMap,
    };

    await this.storeMatch(contract, compilationResult, match);

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
    throw new Error(`Invalid match status: ${status}`);
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
    const cborData = bytecodeDecode(bytecode);

    if (cborData["bzzr0"]) {
      return `/swarm/bzzr0/${cborData["bzzr0"]}`;
    } else if (cborData["bzzr1"]) {
      return `/swarm/bzzr1/${cborData["bzzr1"]}`;
    } else if (cborData["ipfs"]) {
      return `/ipfs/${cborData["ipfs"]}`;
    }

    SourcifyEventManager.trigger("Verification.Error", {
      message:
        "getMetadataPathFromCborEncoded: No metadata hash in cbor encoded data.",
      details: {
        address,
        chain,
      },
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
   * Writes the create2 arguments to the repository.
   * @param matchQuality
   * @param chain
   * @param address
   * @param create2Args
   */
  private storeCreate2Args(
    matchQuality: MatchQuality,
    chain: string,
    address: string,
    create2Args: Create2Args
  ) {
    this.fileService.save(
      {
        matchQuality,
        chain,
        address,
        source: false,
        fileName: "create2-args.json",
      },
      JSON.stringify(create2Args)
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
    if (!this.ipfsClient) return;
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
}
