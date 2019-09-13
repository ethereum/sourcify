#!/usr/bin/env node

'use strict';

if (process.argv.length < 4) {
    console.log("Usage: testVerification.js <contract address> <call payload data>")
    process.exit(1)
}

let Web3 = require('web3')
let cbor = require('cbor')
let request = require('request-promise-native')
let solc = require('solc')

var exports = module.exports = {}

let cborDecode = function(bytecode)
{
    let cborLength = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1]
    return cbor.decodeFirstSync(new Buffer(bytecode.slice(bytecode.length - 2 - cborLength, -2)))
}

let retrieveSingleSource = async function(name, urls)
{
    console.log(" - " + name)
    for (var url of urls) {
        if (url.startsWith('bzz-raw')) {
            console.log("    (via swarm: " + url + ")")
            return await request('https://swarm-gateways.net/' + url)
        }
        // TODO also try ipfs
    }
    throw "Source " + name + " could not be found."
}
let retrieveSources = async function(sources)
{
    var output = {}
    for (var s in sources) {
        // TODO support literals sources
        output[s] = await retrieveSingleSource(s, sources[s]['urls'])
    }
    return output
}

let getBytecodeMetadataAndSources = async function(web3, address) {
    address = web3.utils.toChecksumAddress(address)
    console.log("Retrieving bytecode of contract at address " + address + "...")
    let bytecode = await web3.eth.getCode(address)
    let cborData = cborDecode(web3.utils.hexToBytes(bytecode))
    console.log(
        "Contract compiled with Solidity " +
        (cborData['solc'][0]) + "." +
        (cborData['solc'][1]) + "." +
        (cborData['solc'][2])
    )
    let metadataBzzr1 = web3.utils.bytesToHex(cborData['bzzr1']).slice(2)
    console.log("Retrieving metadata from swarm gateway. Hash: " + metadataBzzr1)
    let metadataRaw = await request('https://swarm-gateways.net/bzz-raw:/' + metadataBzzr1)
    let metadata = JSON.parse(metadataRaw)
    console.log("Retrieving sources...")
    let sources = await retrieveSources(metadata.sources)
    console.log("Have everything needed to verify compilation.")
    return {bytecode: bytecode, metadataRaw: metadataRaw, metadata: metadata, sources: sources}

};


let reformatMetadata = function(metadata, sources) {
    let input = {}
    input['settings'] = metadata['settings']
    let fileName = ''
    let contractName = ''
    for (fileName in metadata['settings']['compilationTarget'])
        contractName = metadata['settings']['compilationTarget'][fileName]
    delete input['settings']['compilationTarget']

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
                reject()
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

let web3 = new Web3('https://ropsten.infura.io/v3/891fe57328084fcca24912b662ad101f')

let run = async function(addr, payload)
{
    let data = await getBytecodeMetadataAndSources(web3, addr)
    let output = await recompile(data.metadata, data.sources)
    if (output.metadata == data.metadataRaw) {
        console.log("Metadata matches!")
    } else {
        console.log("Metadata does NOT match!")
        console.log("From chain:")
        console.log(data.metadataRaw)
        console.log("After recompilation:")
        console.log(output.metadata)
        process.exit(1)
    }
    if (output.deployedBytecode == data.bytecode) {
        console.log("Deployed bytecode matches! (Note that constructor can still be different!)")
    } else {
        console.log("Deployed bytecode does NOT match!")
        console.log("From chain:")
        console.log(data.bytecode)
        console.log("After recompilation:")
        console.log(output.deployedBytecode)
        process.exit(1)
    }

    console.log('')

    if (payload.substr(0, 2) == '0x') {
        payload = payload.substr(2)
    }
    let userdoc = data.metadata['output']['userdoc']['methods']
    for (var signature in userdoc) {
        var selector = web3.utils.keccak256(signature).substr(2, 8)
        if (payload.substr(0, 8) == selector) {
            console.log("You are calling the function")
            console.log("  " + signature)
            console.log("Description: \"" + userdoc[signature]['notice'] + '\"')
            return
        }
    }
    console.log("Function with selector " + payload.substr(0, 8) + " not found!")
    console.log("Be careful with this transaction!")
    process.exit(1)
}

run(process.argv[2], process.argv[3])
    .catch(console.log)
