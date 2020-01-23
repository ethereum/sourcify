'use strict';

let Web3 = require('web3')
let solc = require('solc')
let cbor = require('cbor')
let fsextra = require('fs-extra')
let multihashes = require('multihashes');

let addressDB = require('./address-db.js')

var exports = module.exports = {}

let chains = {}

// For unit testing with testrpc...
if (process.env.TESTING){
  chains['localhost'] = {
    web3: new Web3('http://localhost:8545')
  };
}

for (let chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli'])
{
    chains[chain] = {};
    chains[chain].web3 = new Web3('https://' + chain + '.infura.io/v3/891fe57328084fcca24912b662ad101f');
}

let getBytecode = async function(web3, address) {
  address = web3.utils.toChecksumAddress(address)
  console.log("Retrieving bytecode of contract at address " + address + "...")
  return await web3.eth.getCode(address)
};

let cborDecode = function(bytecode)
{
    let cborLength = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1]
    return cbor.decodeFirstSync(new Buffer(bytecode.slice(bytecode.length - 2 - cborLength, -2)))
}


let reformatMetadata = function(metadata, sources) {
  let input = {}
  input['settings'] = metadata['settings']
  let fileName = ''
  let contractName = ''
  for (fileName in metadata['settings']['compilationTarget'])
      contractName = metadata['settings']['compilationTarget'][fileName]
  delete input['settings']['compilationTarget']

  if (contractName == '') {
    throw "Could not determine compilation target from metadata."
  }

  input['sources'] = {}
  for (var source in sources)
      input['sources'][source] = {'content': sources[source]}
  input['language'] = metadata['language']
  input['settings']['metadata'] = input['settings']['metadata'] || {}
  input['settings']['outputSelection'] = input['settings']['outputSelection'] || {}
  input['settings']['outputSelection'][fileName] = input['settings']['outputSelection'][fileName] || {}
  input['settings']['outputSelection'][fileName][contractName] = ['evm.bytecode', 'evm.deployedBytecode', 'metadata']

  return {
      input: input,
      fileName: fileName,
      contractName: contractName
  }
}

let recompile = async function(metadata, sources) {
  let reformatted = reformatMetadata(metadata, sources)
  let input = reformatted.input
  let fileName = reformatted.fileName
  let contractName = reformatted.contractName

  console.log('Re-compiling ' + fileName + ':' + contractName + ' with Solidity ' + metadata['compiler']['version'])
  console.log('Retrieving compiler...')
  let solcjs = await new Promise((resolve, reject) => {
      solc.loadRemoteVersion('v' + metadata['compiler']['version'], (error, soljson) => {
          if (error) {
              reject(error)
          } else {
              resolve(soljson)
          }
      })
  })
  console.log('Compiling...');
  let output = JSON.parse(solcjs.compile(JSON.stringify(input)));
  return {
      bytecode: output['contracts'][fileName][contractName]['evm']['bytecode']['object'],
      deployedBytecode: '0x' + output['contracts'][fileName][contractName]['evm']['deployedBytecode']['object'],
      metadata: output['contracts'][fileName][contractName]['metadata'].trim()
  }
}

let findMetadataFile = function(files) {
  for (let i in files) {
    try {
      const file = JSON.parse(JSON.parse(files[i]))
      if (file['language'] === 'Solidity') {
        return file
      }
    } catch (err) { }
  }
  throw "Metadata file not found. Did you include \"metadata.json\"?"
}

let storeByHash = function(files)
{
  let byHash = {}
  for (var i in files) {
    byHash[Web3.utils.keccak256(files[i])] = files[i]
  }
  return byHash
}

let rearrangeSources = function(metadata, files) {
  let sources = {}
  let byHash = storeByHash(files)
  for (var fileName in metadata.sources) {
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


let storeData = function(repository, chain, address, compilationResult, sources)
{
  let cborData = cborDecode(Web3.utils.hexToBytes(compilationResult.deployedBytecode))
  let metadataPath
  if (cborData['bzzr0']) {
    metadataPath = '/swarm/bzzr0/' + Web3.utils.bytesToHex(cborData['bzzr0']).slice(2)
  } else if (cborData['bzzr1']) {
    metadataPath = '/swarm/bzzr1/' + Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)
  } else if (cborData['ipfs']) {
    metadataPath = '/ipfs/' + multihashes.toB58String(cborData['ipfs']);
  } else {
    throw "Re-compilation successful, but could not find reference to metadata file in cbor data."
  }
  fsextra.outputFileSync(repository + metadataPath, compilationResult.metadata);
  fsextra.outputFileSync(repository + '/contract/' + chain + '/' + address + '/metadata.json', compilationResult.metadata);
  for (var path in sources) {
    let pathSanitized = path.replace(/[^a-z0-9_.\/-]/gim, "_").replace(/(^|\/)[.]+($|\/)/, '_')
    fsextra.outputFileSync(repository + '/contract/' + chain + '/' + address + '/sources/' + pathSanitized, sources[path]);
  }
}

exports.inject = async function(repository, chain, address, files) {
  if (address) {
    address = Web3.utils.toChecksumAddress(address)
  }
  let metadata = findMetadataFile(files)
  let sources = rearrangeSources(metadata, files)
  // Starting from here, we cannot trust the metadata object anymore,
  // because it is modified inside recompile.
  let compilationResult = await recompile(metadata, sources)

  let addresses = []
  if (address) {
    let bytecode = await getBytecode(chains[chain].web3, address)
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
    await storeData(repository, chain, addresses[i], compilationResult, sources)
  }
  return addresses
}

exports.cborDecode = cborDecode;
