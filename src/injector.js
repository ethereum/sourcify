const Web3 = require('web3')
const save = require('fs-extra').outputFileSync
const multihashes = require('multihashes');
const path = require('path');
const addressDB = require('./address-db');

const {
  cborDecode,
  getBytecode,
  recompile
} = require('./utils');

class Injector {
  constructor(config={}){
    this.chains = {};
    this.infuraPID = config.infuraPID || "891fe57328084fcca24912b662ad101f";
    this._initChains();
  }

  _initChains(){
    for (let chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli']){
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

  findMetadataFile(files) {
    for (let i in files) {
      try {
        let m = JSON.parse(files[i])
        if (m['language'] === 'Solidity') {
          return m
        }
      } catch (err) { }
    }
    throw "Metadata file not found. Did you include \"metadata.json\"?"
  }

  storeByHash(files){
    let byHash = {}
    for (var i in files) {
      byHash[Web3.utils.keccak256(files[i])] = files[i]
    }
    return byHash;
  }

  rearrangeSources(metadata, files) {
    const sources = {}
    const byHash = this.storeByHash(files);

    for (let fileName in metadata.sources) {
      let content = metadata.sources[fileName]['content']
      let hash = metadata.sources[fileName]['keccak256']
      if(content) {
          if (Web3.utils.keccak256(content) != hash) {
              throw("invalid content for file " + fileName);
          }
      } else {
        content = byHash[hash];
      }
      if (!content) {
        throw (
          "The metadata file mentions a source file called \"" +
          fileName +
          "\" that cannot be fonud in your upload.\n" +
          "Its keccak256 hash is " + hash +
          ". Please try to find it and include it in the upload."
        )
      }
      sources[fileName] = content
    }
    return sources
  }


  storeData(repository, chain, address, compilationResult, sources){
    let metadataPath;
    const cborData = cborDecode(Web3.utils.hexToBytes(compilationResult.deployedBytecode));

    if (cborData['bzzr0']) {
      metadataPath = '/swarm/bzzr0/' + Web3.utils.bytesToHex(cborData['bzzr0']).slice(2)
    } else if (cborData['bzzr1']) {
      metadataPath = '/swarm/bzzr1/' + Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)
    } else if (cborData['ipfs']) {
      metadataPath = '/ipfs/' + multihashes.toB58String(cborData['ipfs']);
    } else {
      throw "Re-compilation successful, but could not find reference to metadata file in cbor data."
    }

    const hashPath = path.join(repository, metadataPath);
    const addressPath = path.join(repository, 'contract', chain, address, '/metadata.json');

    save(hashPath, compilationResult.metadata);
    save(addressPath, compilationResult.metadata);

    for (let sourcePath in sources) {

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

  async inject(repository, chain, address, files) {
    if (address) {
      address = Web3.utils.toChecksumAddress(address)
    }

    const addresses = [];
    const metadata = this.findMetadataFile(files)
    const sources = this.rearrangeSources(metadata, files)

    // Starting from here, we cannot trust the metadata object anymore,
    // because it is modified inside recompile.
    const compilationResult = await recompile(metadata, sources)

    if (address) {
      let bytecode = await getBytecode(this.chains[chain].web3, address)
      if (compilationResult.deployedBytecode != bytecode) {
        throw (
          "Bytecode does not match.\n" +
          "On-chain deployed bytecode: " + bytecode + "\n" +
          "Re-compiled bytecode: " + compilationResult.deployedBytecode + "\n"
        )
      }
      addresses.push(address)
    } else {
      // TODO this should probably return pairs of chain and address
      addresses = await addressDB.findAddresses(chain, compilationResult.deployedBytecode)
      if (addresses.length == 0) {
        throw (
          "Contract compiled successfully, but could not find matching bytecode " +
          "and no address provided.\n" +
          "Re-compiled bytecode: " + compilationResult.deployedBytecode + "\n"
        )
      }
    }
    // Since the bytecode matches, we can be sure that we got the right
    // metadata file (up to json formatting) and exactly the right sources.
    // Now we can store the re-compiled and correctly formatted metadata file
    // and the sources.

    for (let i in addresses) {
      await this.storeData(repository, chain, addresses[i], compilationResult, sources)
    }
    return addresses
  }
}

module.exports = Injector;
