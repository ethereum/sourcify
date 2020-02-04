const cbor = require('cbor');
const solc = require('solc');

const cborDecode = function(bytecode) {
  const cborLength = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1]
  return cbor.decodeFirstSync(new Buffer(bytecode.slice(bytecode.length - 2 - cborLength, -2)))
}

const getBytecode = async function(web3, address) {
  address = web3.utils.toChecksumAddress(address)
  console.log("Retrieving bytecode of contract at address " + address + "...")
  return await web3.eth.getCode(address)
};

const reformatMetadata = function(metadata, sources) {
  const input = {};
  let fileName = '';
  let contractName = '';

  input['settings'] = metadata['settings'];

  for (fileName in metadata['settings']['compilationTarget']){
    contractName = metadata['settings']['compilationTarget'][fileName];
  }

  delete input['settings']['compilationTarget']

  if (contractName == '') {
    throw "Could not determine compilation target from metadata."
  }

  input['sources'] = {}
  for (let source in sources){
    input['sources'][source] = {'content': sources[source]}
  }

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

const recompile = async function(metadata, sources) {
  const reformatted = reformatMetadata(metadata, sources)
  const input = reformatted.input
  const fileName = reformatted.fileName
  const contractName = reformatted.contractName

  console.log('Re-compiling ' + fileName + ':' + contractName + ' with Solidity ' + metadata['compiler']['version'])
  console.log('Retrieving compiler...')

  const solcjs = await new Promise((resolve, reject) => {
    solc.loadRemoteVersion('v' + metadata['compiler']['version'], (error, soljson) => {
      if (error) {
          reject(error)
      } else {
          resolve(soljson)
      }
    })
  })
  console.log('Compiling...');

  const output = JSON.parse(solcjs.compile(JSON.stringify(input)));
  return {
    bytecode: output['contracts'][fileName][contractName]['evm']['bytecode']['object'],
    deployedBytecode: '0x' + output['contracts'][fileName][contractName]['evm']['deployedBytecode']['object'],
    metadata: output['contracts'][fileName][contractName]['metadata'].trim()
  }
}

module.exports = {
  cborDecode: cborDecode,
  getBytecode: getBytecode,
  recompile: recompile
}

