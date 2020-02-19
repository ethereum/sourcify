import Web3 from 'web3';
import { outputFileSync } from 'fs-extra';
import path from 'path';

const addressDB: any = require('./address-db');
const multihashes : any = require('multihashes');

const save = outputFileSync;

import {
  cborDecode,
  getBytecode,
  recompile,
  RecompilationResult,
} from './utils';

export interface InjectorConfig {
  infuraPID? : string
}

export default class Injector {
  private chains : any;
  private infuraPID : string;

  public constructor(config : InjectorConfig = {}){
    this.chains = {};
    this.infuraPID = config.infuraPID || "891fe57328084fcca24912b662ad101f";
    this.initChains();
  }

  private initChains(){
    for (const chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli']){
      this.chains[chain] = {};
      this.chains[chain].web3 = new Web3(`https://${chain}.infura.io/v3/${this.infuraPID}`);
    }

    // For unit testing with testrpc...
    if (process.env.TESTING){
      this.chains['localhost'] = {
        web3: new Web3('http://localhost:8545')
      };
    }
  }

  private findMetadataFile(files: string[]) : string {
    for (const i in files) {
      try {
        const m = JSON.parse(files[i])
        if (m['language'] === 'Solidity') {
          return m;
        }
      } catch (err) { /* ignore */ }
    }
    throw new Error("Metadata file not found. Did you include \"metadata.json\"?");
  }

  private storeByHash(files: string[]) : any {
    const byHash: any = {};

    for (const i in files) {
      byHash[Web3.utils.keccak256(files[i])] = files[i]
    }
    return byHash;
  }

  private rearrangeSources(metadata : any, files: string[]) : any {
    const sources: any = {}
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

  private storeData(
    repository: string,
    chain : string,
    address : string,
    compilationResult : RecompilationResult,
    sources: any
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

  public async inject(
    repository: string,
    chain: string,
    address: string,
    files: string[]
  ) : Promise<string[]> {

    if (address) {
      address = Web3.utils.toChecksumAddress(address)
    }

    let addresses = [];
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
      // TODO this should probably return pairs of chain and address
      addresses = await addressDB.findAddresses(chain, compilationResult.deployedBytecode)
      if (addresses.length == 0) {
        throw (
          `Contract compiled successfully, but could not find matching bytecode and no ` +
          `address provided.\n Re-compiled bytecode: ${compilationResult.deployedBytecode}\n`
        )
      }
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
