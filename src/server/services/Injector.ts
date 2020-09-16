import Web3 from 'web3';
import path from 'path';
import config from '../../config';
import { Logger } from '../../../services/core/build/index'
import * as bunyan from 'bunyan';
import { Match, InputData, StringMap, getChainByName, cborDecode } from '../../../services/core/build/index';
import { recompile, RecompilationResult } from '../../../services/verification/build/index';
import { FileService } from '../services/FileService';

const multihashes: any = require('multihashes');

// import {
//   getBytecode,
//   getBytecodeWithoutMetadata as trimMetadata,
//   save
// } from '../../../services/core/build/index';
import { NotFoundError } from '../../../services/core/build/index';

export interface InjectorConfig {
  infuraPID?: string,
  localChainUrl?: string,
  silent?: boolean,
  log?: bunyan,
  offline?: boolean
}

export default class Injector {
  private log: bunyan;
  private chains: any;
  private infuraPID: string;
  private localChainUrl: string | undefined;
  private offline: boolean;
  public fileService: FileService;

  /**
   * Constructor
   * @param {InjectorConfig = {}} config
   */
  public constructor(config: InjectorConfig = {}) {
    this.chains = {};
    this.infuraPID = config.infuraPID || "changeinfuraid";
    this.localChainUrl = config.localChainUrl;
    this.offline = config.offline || false;

    this.log = config.log || Logger("Injector");

    this.fileService = new FileService(this.log);

    if (!this.offline) {
      this.initChains();
    }
  }

  /**
   * Instantiates a web3 provider for all public ethereum networks via Infura.
   * If environment variable TESTING is set to true, localhost:8545 is also available.
   */
  private initChains() {
    for (const chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli']) {
      const chainOption = getChainByName(chain);
      this.chains[chainOption.chainId] = {};
      if (this.infuraPID === "changeinfuraid") {
        const web3 = chainOption.fullnode.dappnode;
        this.chains[chainOption.chainId].web3 = new Web3(web3);
      } else {
        const web3 = chainOption.web3[0].replace('${INFURA_ID}', this.infuraPID);
        this.chains[chainOption.chainId].web3 = new Web3(web3);
      }
    }

    // For unit testing with testrpc...
    if (this.localChainUrl) {
      const chainOption = getChainByName('localhost');
      this.chains[chainOption.chainId] = {
        web3: new Web3(chainOption.web3[0])
      };
    }
  }

  /**
   * Writes verified sources to repository by address and by ipfs | swarm hash
   * @param {string}              repository        repository root (ex: 'repository')
   * @param {string}              chain             chain name (ex: 'ropsten')
   * @param {string}              address           contract address
   * @param {RecompilationResult} compilationResult solc output
   * @param {StringMap}           sources           'rearranged' sources
   */
  private storePerfectMatchData(
    repository: string,
    chain: string,
    address: string,
    compilationResult: RecompilationResult,
    sources: StringMap
  ): void {

    let metadataPath: string;
    const bytes = Web3.utils.hexToBytes(compilationResult.deployedBytecode);
    const cborData = cborDecode(bytes);

    if (cborData['bzzr0']) {
      metadataPath = `/swarm/bzzr0/${Web3.utils.bytesToHex(cborData['bzzr0']).slice(2)}`;
    } else if (cborData['bzzr1']) {
      metadataPath = `/swarm/bzzr1/${Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)}`;
    } else if (cborData['ipfs']) {
      metadataPath = `/ipfs/${multihashes.toB58String(cborData['ipfs'])}`;
    } else {
      const err = new Error(
        "Re-compilation successful, but could not find reference to metadata file in cbor data."
      );

      this.log.info({
        loc: '[STOREDATA]',
        address: address,
        chain: chain,
        err: err
      });

      throw err;
    }

    const hashPath = path.join(repository, metadataPath);
    const addressPath = path.join(
      repository,
      'contracts',
      'full_match',
      chain,
      address,
      '/metadata.json'
    );

    // save(hashPath, compilationResult.metadata);
    // save(addressPath, compilationResult.metadata);

    for (const sourcePath in sources) {

      const sanitizedPath = sourcePath
        .replace(/[^a-z0-9_.\/-]/gim, "_")
        .replace(/(^|\/)[.]+($|\/)/, '_');

      const outputPath = path.join(
        repository,
        'contracts',
        'full_match',
        chain,
        address,
        'sources',
        sanitizedPath
      );

      //save(outputPath, sources[sourcePath]);
    }
  }

  /**
   * Writes verified sources to repository by address under the "partial_match" folder.
   * This method used when recompilation bytecode matches deployed *except* for their
   * metadata components.
   * @param {string}              repository        repository root (ex: 'repository')
   * @param {string}              chain             chain name (ex: 'ropsten')
   * @param {string}              address           contract address
   * @param {RecompilationResult} compilationResult solc output
   * @param {StringMap}           sources           'rearranged' sources
   */
  private storePartialMatchData(
    repository: string,
    chain: string,
    address: string,
    compilationResult: RecompilationResult,
    sources: StringMap
  ): void {

    const addressPath = path.join(
      repository,
      'contracts',
      'partial_match',
      chain,
      address,
      '/metadata.json'
    );

    //save(addressPath, compilationResult.metadata);

    for (const sourcePath in sources) {

      const sanitizedPath = sourcePath
        .replace(/[^a-z0-9_.\/-]/gim, "_")
        .replace(/(^|\/)[.]+($|\/)/, '_');

      const outputPath = path.join(
        repository,
        'contracts',
        'partial_match',
        chain,
        address,
        'sources',
        sanitizedPath
      );

      //save(outputPath, sources[sourcePath]);
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
    compiledBytecode: string
  ): Promise<Match> {
    let match: Match = { address: null, status: null };

    for (let address of addresses) {
      address = Web3.utils.toChecksumAddress(address)

      let deployedBytecode: string | null = null;
      try {
        this.log.info(
          {
            loc: '[MATCH]',
            chain: chain,
            address: address
          },
          `Retrieving contract bytecode address`
        );
        //deployedBytecode = await getBytecode(this.chains[chain].web3, address)
      } catch (e) { /* ignore */ }

      const status = this.compareBytecodes(deployedBytecode, compiledBytecode);

      if (status) {
        match = { address: address, status: status };
        break;
      }
    }
    return match;
  }

  /**
   * Returns a string description of how closely two bytecodes match. Bytecodes
   * that match in all respects apart from their metadata hashes are 'partial'.
   * Bytecodes that don't match are `null`.
   * @param  {string} deployedBytecode
   * @param  {string} compiledBytecode
   * @return {string | null}  match description ('perfect'|'partial'|null)
   */
  private compareBytecodes(
    deployedBytecode: string | null,
    compiledBytecode: string
  ): 'perfect' | 'partial' | null {

    if (deployedBytecode && deployedBytecode.length > 2) {
      if (deployedBytecode === compiledBytecode) {
        return 'perfect';
      }

      // if (trimMetadata(deployedBytecode) === trimMetadata(compiledBytecode)) {
      //   return 'partial';
      // }
    }
    return null;
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

    if (!chain || typeof chain !== 'string') {
      throw new Error("Missing chain name for submitted sources/metadata");;
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
  public async inject(
    inputData: InputData
  ): Promise<Match> {
    const { repository, chain, addresses, files } = inputData;
    this.validateAddresses(addresses);
    this.validateChain(chain);

    let match: Match = {
      address: null,
      status: null
    };

    for (const source of files) {

      // Starting from here, we cannot trust the metadata object anymore,
      // because it is modified inside recompile.
      const target = Object.assign({}, source.metadata.settings.compilationTarget);

      let compilationResult: RecompilationResult;
      try {
        compilationResult = await recompile(source.metadata, source.solidity, this.log)
      } catch (err) {
        this.log.info({ loc: `[RECOMPILE]`, err: err });
        throw err;
      }

      // When injector is called by monitor, the bytecode has already been
      // obtained for address and we only need to compare w/ compilation result.
      if (inputData.bytecode) {

        const status = this.compareBytecodes(
          inputData.bytecode,
          compilationResult.deployedBytecode
        )

        match = {
          address: Web3.utils.toChecksumAddress(addresses[0]),
          status: status
        }

        // For other cases, we need to retrieve the code for specified address
        // from the chain.
      } else {
        match = await this.matchBytecodeToAddress(
          chain,
          addresses,
          compilationResult.deployedBytecode
        )
      }

      // Since the bytecode matches, we can be sure that we got the right
      // metadata file (up to json formatting) and exactly the right sources.
      // Now we can store the re-compiled and correctly formatted metadata file
      // and the sources.
      if (match.address && match.status === 'perfect') {

        this.storePerfectMatchData(repository, chain, match.address, compilationResult, source.solidity)

      } else if (match.address && match.status === 'partial') {

        this.storePartialMatchData(repository, chain, match.address, compilationResult, source.solidity)

      } else {
        const err = new Error(
          `Could not match on-chain deployed bytecode to recompiled bytecode for:\n` +
          `${JSON.stringify(target, null, ' ')}\n` +
          `Addresses checked:\n` +
          `${JSON.stringify(addresses, null, ' ')}`
        );

        this.log.info({
          loc: '[INJECT]',
          chain: chain,
          addresses: addresses,
          err: err
        })

        throw new NotFoundError(err.message);
      }
    }
    return match;
  }
}