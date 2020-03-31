import Web3 from 'web3';
import { outputFileSync } from 'fs-extra';
import path from 'path';

// tslint:disable no-commented-code
// import { findAddresses } from './address-db';

const multihashes : any = require('multihashes');

const save = outputFileSync;

import {
  cborDecode,
  getBytecode,
  resolveAddress,
  recompile,
  RecompilationResult,
} from './utils';

declare interface StringMap {
  [key: string]: string;
}

export interface InjectorConfig {
  infuraPID? : string,
  localChainUrl? : string
}

export default class Injector {
  private chains : any;
  private infuraPID : string;
  private localChainUrl: string | undefined;

  /**
   * Constructor
   * @param {InjectorConfig = {}} config
   */
  public constructor(config : InjectorConfig = {}){
    this.chains = {};
    this.infuraPID = config.infuraPID || "891fe57328084fcca24912b662ad101f";
    this.localChainUrl = config.localChainUrl;
    this.initChains();
  }

  /**
   * Instantiates a web3 provider for all public ethereum networks via Infura.
   * If environment variable TESTING is set to true, localhost:8545 is also available.
   */
  private initChains(){
    for (const chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli']){
      this.chains[chain] = {};
      this.chains[chain].web3 = new Web3(`https://${chain}.infura.io/v3/${this.infuraPID}`);
    }

    // For unit testing with testrpc...
    if (this.localChainUrl){
      this.chains['localhost'] = {
        web3: new Web3(this.localChainUrl)
      };
    }
  }

  /**
   * Selects metadata file from an array of files that may include sources, etc
   * @param  {string[]} files
   * @return {string}         metadata
   */
  private findMetadataFile(files: string[]) : string {
    for (const i in files) {
      try {
        const m = JSON.parse(files[i])

        // TODO: this might need a stronger validation check.
        //       many assumptions are made about structure of
        //       metadata object after this selection step.
        if (m['language'] === 'Solidity') {
          return m;
        }
      } catch (err) { /* ignore */ }
    }
    throw new Error("Metadata file not found. Did you include \"metadata.json\"?");
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
              throw new Error(`Invalid content for file ${fileName}`);
          }
      } else {
        content = byHash[hash];
      }
      if (!content) {
        throw new Error(
          `The metadata file mentions a source file called "${fileName}"` +
          `that cannot be fonud in your upload.\nIts keccak256 hash is ${hash}. ` +
          `Please try to find it and include it in the upload.`
        );
      }
      sources[fileName] = content;
    }
    return sources
  }

  /**
   * Writes verified sources to repository by address and by ipfs | swarm hash
   * @param {string}              repository        repository root (ex: 'repository')
   * @param {string}              chain             chain name (ex: 'ropsten')
   * @param {string}              address           contract address
   * @param {RecompilationResult} compilationResult solc output
   * @param {StringMap}           sources           'rearranged' sources
   */
  private storeData(
    repository: string,
    chain : string,
    address : string,
    compilationResult : RecompilationResult,
    sources: StringMap
  ) : void {

    let metadataPath : string;
    const bytes = Web3.utils.hexToBytes(compilationResult.deployedBytecode);
    const cborData = cborDecode(bytes);

    if (cborData['bzzr1']) {
      metadataPath = `/swarm/bzzr1/${Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)}`;
    } else if (cborData['ipfs']) {
      metadataPath = `/ipfs/${multihashes.toB58String(cborData['ipfs'])}`;
    } else {
      throw new Error(
        "Re-compilation successful, but could not find reference to metadata file in cbor data."
      );
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
   * Used by the front-end. Accepts a set of source files and a metadata string,
   * recompiles / validates them and stores them in the repository by chain/address
   * and by swarm | ipfs hash.
   * @param  {string}            repository repository root (ex: 'repository')
   * @param  {string}            chain      chain name (ex: 'ropsten')
   * @param  {string}            address    contract address or ENS address
   * @param  {boolean}           isENS      needs to be resolved by ENS
   * @param  {string[]}          files
   * @return {Promise<string[]>}            addresses of successfully verified contracts
   */
  public async inject(
    repository: string,
    chain: string,
    address: string,
    isENS: boolean,
    files: string[]
  ) : Promise<string[]> {

    if (address) {
      if (isENS) {
        address = resolveAddress(address)
      }
      address = Web3.utils.toChecksumAddress(address)
    }

    const addresses = [];
    const metadata = this.findMetadataFile(files)
    const sources = this.rearrangeSources(metadata, files)

    // Starting from here, we cannot trust the metadata object anymore,
    // because it is modified inside recompile.
    const compilationResult = await recompile(metadata, sources)

    if (address) {
      const bytecode = await getBytecode(this.chains[chain].web3, address)
      if (compilationResult.deployedBytecode != bytecode) {
        throw new Error(
          `Bytecode does not match.\n"On-chain deployed bytecode: ${bytecode}\n` +
          `Re-compiled bytecode: ${compilationResult.deployedBytecode}\n`
        )
      }
      addresses.push(address)
    } else {
      // TODO: implement address db writes
      // TODO this should probably return pairs of chain and address

      // tslint:disable no-commented-code
      /*
      addresses = await findAddresses(chain, compilationResult.deployedBytecode)
      if (addresses.length == 0) {
        throw (
          `Contract compiled successfully, but could not find matching bytecode and no ` +
          `address provided.\n Re-compiled bytecode: ${compilationResult.deployedBytecode}\n`
        )
      }
      */
    }
    // Since the bytecode matches, we can be sure that we got the right
    // metadata file (up to json formatting) and exactly the right sources.
    // Now we can store the re-compiled and correctly formatted metadata file
    // and the sources.
    for (const i in addresses) {
      this.storeData(repository, chain, addresses[i], compilationResult, sources)
    }
    return addresses
  }
}
