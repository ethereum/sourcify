#!/usr/bin/env node

'use strict';

if (process.argv.length < 3) {
    console.log("Usage: monitor.js <repository path> [<chain> <address>]")
    process.exit(1)
}

let Web3 = require('web3')
let ethers = require('ethers')
let cbor = require('cbor')
let request = require('request-promise-native')
let fs = require('fs')
let fsextra = require('fs-extra')

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

let repository = process.argv[2];
let chains = {}
for (let chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli'])
{
    chains[chain] = {};
    chains[chain].web3 = new Web3('https://' + chain + '.infura.io/v3/891fe57328084fcca24912b662ad101f');
    chains[chain].metadataQueue = {};
    chains[chain].sourceQueue = {};
    chains[chain].latestBlock = 0;
    (function(chain) {
        chains[chain].web3.eth.getBlockNumber((err, nr) => {
            console.log(chain + ": Starting from block " + nr);
            chains[chain].latestBlock = nr;
        });
    })(chain);
}

let retrieveCode = function(chain, address)
{
    let web3 = chains[chain].web3;
    web3.eth.getCode(address, (err, bytecode) => {
        try {
            let cborData = cborDecode(web3.utils.hexToBytes(bytecode))
            if (cborData && 'bzzr1' in cborData) {
                let metadataBzzr1 = web3.utils.bytesToHex(cborData['bzzr1']).slice(2)
                console.log("[BLOCKS] Queueing retrievel of metadata for " + chain + " " + address + ": bzzr1 " + metadataBzzr1)
                chains[chain].metadataQueue[address] = {bzzr1: metadataBzzr1};
            } else if (cborData && 'bzzr0' in cborData) {
                let metadataBzzr0 = web3.utils.bytesToHex(cborData['bzzr0']).slice(2);
                console.log("[BLOCKS] Queueing retrievel of metadata for " + chain + " " + address + ": bzzr0 " + metadataBzzr0)
                chains[chain].metadataQueue[address] = {bzzr0: metadataBzzr0};
            }
            // TODO handle ipfs
        } catch (error) {}
    })
}

let retrieveBlocks = function()
{
    for (let chain in chains) {
        retrieveBlocksInChain(chain);
    }
}
let retrieveBlocksInChain = function(chain)
{
    let web3 = chains[chain].web3;
    web3.eth.getBlockNumber((err, newBlockNr) => {
        newBlockNr = Math.min(newBlockNr, chains[chain].latestBlock + 4);
        for (; chains[chain].latestBlock < newBlockNr; chains[chain].latestBlock++) {
            web3.eth.getBlock(chains[chain].latestBlock, true, (err, block) => {
                if (err || !block) {
                    console.log("[BLOCKS] " + chain + " Block " + chains[chain].latestBlock + " not available: " + err);
                    return;
                }
                console.log("[BLOCKS] " + chain + " Processing Block " + block.number + ":");
                for (var i in block.transactions) {
                    let t = block.transactions[i]
                    if (t.to === null) {
                        let address = ethers.utils.getContractAddress(t);
                        console.log("[BLOCKS] " + address);
                        retrieveCode(chain, address);
                    }
                }
            });
        }
    });
}

let retrieveMetadata = function()
{
    for (let chain in chains) {
        retrieveMetadataInChain(chain);
    }
}
let retrieveMetadataInChain = function(chain)
{
    console.log("[METADATA] " + chain + " Processing metadata queue...");
    for (let address in chains[chain].metadataQueue) {
        console.log("[METADATA] " + address);
        (async function(address, metadataBzzr1, metadataBzzr0) {
            let metadataRaw
            if (metadataBzzr1) {
                try {
                    // TODO guard against too large files
                    // TODO only write files after recompilation check?
                    metadataRaw = await request('https://swarm-gateways.net/bzz-raw:/' + metadataBzzr1);
                } catch (error) { return; }
            } else if (metadataBzzr0) {
                try {
                    metadataRaw = fs.readFileSync(repository + '/swarm/bzzr0/' + metadataBzzr0)
                } catch (error) { return; }
            } else {
                throw "unknown metadata url";
            }
            console.log("[METADATA] Got metadata for " + chain + " " + address);
            fsextra.outputFileSync(repository + '/swarm/bzzr1/' + metadataBzzr1, metadataRaw);
            fsextra.outputFileSync(repository + '/contract/' + chain + '/' + address + '/metadata.json', metadataRaw);
            let metadata = JSON.parse(metadataRaw);
            delete chains[chain].metadataQueue[address];
            chains[chain].sourceQueue[address] = {
                metadataRaw: metadataRaw,
                sources: metadata.sources
            }
        })(address, chains[chain].metadataQueue[address]['bzzr1'], chains[chain].metadataQueue[address]['bzzr0']);
    }
}

let sourceFound = function(chain, address, path, source)
{
    let pathSanitized = path.replace(/[^a-z0-9_.\/-]/gim, "_").replace(/(^|\/)[.]+($|\/)/, '_')
    fsextra.outputFileSync(repository + '/contract/' + chain + '/' + address + '/sources/' + pathSanitized, source);

    delete chains[chain].sourceQueue[address].sources[path]
    console.log("[SOURCES] " + chain + " " + address + " Sources left to be retrieved: ");
    console.log(Object.keys(chains[chain].sourceQueue[address].sources));
    if (Object.keys(chains[chain].sourceQueue[address].sources).length == 0) {
        delete chains[chain].sourceQueue[address];
    }
}

let retrieveSource = function()
{
    for (let chain in chains) {
        retrieveSourceInChain(chain);
    }
}
let retrieveSourceInChain = function(chain)
{
    console.log("[SOURCE] Processing source queue...");
    for (let address in chains[chain].sourceQueue) {
        console.log("[SOURCE] " + chain + " " + address);
        (function(address, metadataRaw, sources) {
            for (var s in sources) {
                for (var url of sources[s]['urls']) {
                    if (url.startsWith('bzz-raw')) {
                        (async function(chain, address, path, url) {
                            try {
                                let source = await request('https://swarm-gateways.net/' + url);
                                sourceFound(chain, address, path, source);
                            } catch (error) {}
                        })(chain, address, s, url);
                    }
                    // TODO add ipfs and also call sourceFound
                }
                fs.readFile(repository + '/keccak256/' + sources[s]['keccak256'], (err, data) => {
                    if (!err) {
                        sourceFound(chain, address, s, data.toString());
                    }
                });
            }
        })(address, chains[chain].sourceQueue[address].metadataRaw, chains[chain].sourceQueue[address].sources);
    }
}

// After testing, reduce intervals

if (process.argv.length >= 5) {
    retrieveCode(process.argv[3], process.argv[4])
} else {
    setInterval(retrieveBlocks, 1000 * 15);
}

setInterval(retrieveMetadata, 1000 * 15);
setInterval(retrieveSource, 1000 * 15);
