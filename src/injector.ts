import Web3 from 'web3';
import { outputFileSync } from 'fs-extra';
import path from 'path';
import Logger from 'bunyan';
import * as chainOptions from './chains.json';
// tslint:disable no-unused-variable
import fs from 'fs'

// tslint:disable no-commented-code
// import { findAddresses } from './address-db';

const multihashes : any = require('multihashes');

const save = outputFileSync;

import {
  cborDecode,
  getBytecode,
  recompile,
  RecompilationResult,
  getBytecodeWithoutMetadata as trimMetadata,
  InputData,
  NotFound,
  Match,
  getChainByName
} from './utils';

declare interface StringMap {
  [key: string]: string;
}

export interface InjectorConfig {
  infuraPID? : string,
  localChainUrl? : string,
  silent? : boolean,
  log? : Logger,
  offline?: boolean
}

export default class Injector {
  private log : Logger;
  private chains : any;
  private infuraPID : string;
  private localChainUrl: string | undefined;
  private offline: boolean;

  /**
   * Constructor
   * @param {InjectorConfig = {}} config
   */
  public constructor(config : InjectorConfig = {}){
    this.chains = {};
    this.infuraPID = config.infuraPID || "891fe57328084fcca24912b662ad101f";
    this.localChainUrl = config.localChainUrl;
    this.offline = config.offline || false;

    this.log = config.log || Logger.createLogger({
      name: "Injector",
      streams: [{
        stream: process.stdout,
        level: config.silent ? 'fatal' : 30
      }]
    });

    if (!this.offline){
      this.initChains();
    }
  }

  /**
   * Instantiates a web3 provider for all public ethereum networks via Infura.
   * If environment variable TESTING is set to true, localhost:8545 is also available.
   */
  private initChains(){
    for (const chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli']){
      const chainOption = getChainByName(chain);
      this.chains[chainOption.chainId] = {};
      this.chains[chainOption.chainId].web3 = new Web3(chainOption.web3[0]);
    }

    // For unit testing with testrpc...
    if (this.localChainUrl){
      const chainOption = getChainByName('localhost');
      this.chains[chainOption.chainId] = {
        web3: new Web3(chainOption.web3[0])
      };
    }
  }

  /**
   * Selects metadata files from an array of files that may include sources, etc
   * @param  {string[]} files
   * @return {string[]}         metadata
   */
  private findMetadataFiles(files: string[]) : any[] {
    const metadataFiles = [];

    for (const i in files) {
      try {
        const m = JSON.parse(files[i])

        // TODO: this might need a stronger validation check.
        //       many assumptions are made about structure of
        //       metadata object after this selection step.
        if (m['language'] === 'Solidity') {
          metadataFiles.push(m);
        }
      } catch (err) { /* ignore */ }
    }

    if(!metadataFiles.length){
      const err = new Error("Metadata file not found. Did you include \"metadata.json\"?");
      this.log.info({loc:'[FIND]', err: err});
      throw err;
    }

    return metadataFiles;
  }

  /**
   * Generates a map of files indexed by the keccak hash of their contents
   * @param  {string[]}  files sources
   * @return {StringMap}
   */
  private storeByHash(files: string[]) : StringMap {
    const byHash: StringMap = {};

    for (const i in files) {
      byHash[Web3.utils.keccak256(files[i])] = files[i]
    }
    return byHash;
  }

  /**
   * Validates metadata content keccak hashes for all files and
   * returns mapping of file contents by file name
   * @param  {any}       metadata
   * @param  {string[]}  files    source files
   * @return {StringMap}
   */
  private rearrangeSources(metadata : any, files: string[]) : StringMap {
    const sources: StringMap = {}
    const byHash = this.storeByHash(files);

    for (const fileName in metadata.sources) {
      let content: string = metadata.sources[fileName].content;
      const hash: string = metadata.sources[fileName].keccak256;
      if(content) {
          if (Web3.utils.keccak256(content) != hash) {
              const err = new Error(`Invalid content for file ${fileName}`);
              this.log.info({ loc: '[REARRANGE]', fileName: fileName, err: err});
              throw err;
          }
      } else {
        content = byHash[hash];
      }
      if (!content) {
        const err = new Error(
          `The metadata file mentions a source file called "${fileName}" ` +
          `that cannot be found in your upload.\nIts keccak256 hash is ${hash}. ` +
          `Please try to find it and include it in the upload.`
        );
        this.log.info({loc: '[REARRANGE]', fileName: fileName, err: err});
        throw err;
      }
      sources[fileName] = content;
    }
    return sources
  }

  private getIdFromChainName(chain: string): number {
    for(const chainOption in chainOptions) {
      if(chainOptions[chainOption].network === chain){
        return chainOptions[chainOption].chainId;
      }
    }
    throw new NotFound("Chain not found!"); //TODO: should we throw an error here or just let it pass?
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
    chain : string,
    address : string,
    compilationResult : RecompilationResult,
    sources: StringMap
  ) : void {

    let metadataPath : string;
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
        loc:'[STOREDATA]',
        address: address,
        chain: chain,
        err: err
      });

      throw err;
    }

    const hashPath = path.join(repository, metadataPath);
    const addressPath = path.join(repository, 'contract', chain, address, '/metadata.json');

    save(hashPath, compilationResult.metadata);
    save(addressPath, compilationResult.metadata);

    for (const sourcePath in sources) {

      const sanitizedPath = sourcePath
        .replace(/[^a-z0-9_.\/-]/gim, "_")
        .replace(/(^|\/)[.]+($|\/)/, '_');

      const outputPath = path.join(
        repository,
        'contract',
        chain,
        address,
        'sources',
        sanitizedPath
      )

      save(outputPath, sources[sourcePath]);
    }
  }

  /**
   * Writes verified sources to repository by address under the "partial_matches" folder.
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
    chain : string,
    address : string,
    compilationResult : RecompilationResult,
    sources: StringMap
  ) : void {

    const addressPath = path.join(
      repository,
      'partial_matches',
      chain,
      address,
      '/metadata.json'
    );

    save(addressPath, compilationResult.metadata);

    for (const sourcePath in sources) {

      const sanitizedPath = sourcePath
        .replace(/[^a-z0-9_.\/-]/gim, "_")
        .replace(/(^|\/)[.]+($|\/)/, '_');

      const outputPath = path.join(
        repository,
        'partial_matches',
        chain,
        address,
        'sources',
        sanitizedPath
      )

      save(outputPath, sources[sourcePath]);
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
  ) : Promise<Match> {
    let match : Match = { address: null, status: null };

    for (let address of addresses){
      address = Web3.utils.toChecksumAddress(address)

      let deployedBytecode : string | null = null;
      try {
        this.log.info(
          {
            loc: '[MATCH]',
            chain: chain,
            address: address
          },
          `Retrieving contract bytecode address`
        );
        deployedBytecode = await getBytecode(this.chains[chain].web3, address)
      } catch(e){ /* ignore */ }

      const status = this.compareBytecodes(deployedBytecode, compiledBytecode);

      if (status){
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
  ) : 'perfect' | 'partial' | null {

    if (deployedBytecode && deployedBytecode.length > 2){
      if (deployedBytecode === compiledBytecode){
        return 'perfect';
      }

      if (trimMetadata(deployedBytecode) === trimMetadata(compiledBytecode)){
        return 'partial';
      }
    }
    return null;
  }

  /**
   * Throws if addresses array contains a null value (express) or is length 0
   * @param {string[] = []} addresses param (submitted to injector)
   */
  private validateAddresses(addresses: string[] = []){
    const err = new Error("Missing address for submitted sources/metadata");

    if (!addresses.length){
      throw err;
    }

    for (const address of addresses ){
      if (address == null) throw err;
    }
  }

  /**
   * Throws if `chain` is falsy or wrong type
   * @param {string} chain param (submitted to injector)
   */
  private validateChain(chain: string){
    const err = new Error("Missing chain name for submitted sources/metadata");

    if (!chain || typeof chain !== 'string'){
      throw err;
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
   * @return {Promise<object>}              address & status of successfully verified contracts
   */
  public async inject(
    inputData: InputData
  ) : Promise<Match> {
    const { repository, chain, addresses, files } = inputData;
    this.validateAddresses(addresses);
    this.validateChain(chain);

    const metadataFiles = this.findMetadataFiles(files);

    let match: Match = {
      address: null,
      status: null
    };

    for (const metadata of metadataFiles){
      const sources = this.rearrangeSources(metadata, files)

      // Starting from here, we cannot trust the metadata object anymore,
      // because it is modified inside recompile.
      const target = Object.assign({}, metadata.settings.compilationTarget);

      let compilationResult : RecompilationResult;
      try {
        compilationResult = await recompile(metadata, sources, this.log)
      } catch(err) {
        this.log.info({loc: `[RECOMPILE]`, err: err});
        throw err;
      }

      // When injector is called by monitor, the bytecode has already been
      // obtained for address and we only need to compare w/ compilation result.
      if (inputData.bytecode){

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

        this.storePerfectMatchData(repository, chain, match.address, compilationResult, sources)

      } else if (match.address && match.status === 'partial'){

        this.storePartialMatchData(repository, chain, match.address, compilationResult, sources)

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

        throw new NotFound(err.message);
      }
    }
    return match;
  }
}
