#!/usr/bin/env node

'use strict';

let solcjs = require('solc');
let process = require('process');
let fs = require('fs');

function read(stream) {
	let result = '';

	return new Promise(resolve => {
		stream.setEncoding('utf8');

		stream.on('readable', () => {
			let chunk;

			while ((chunk = stream.read())) {
				result += chunk;
			}
		});

		stream.on('end', () => {
			resolve(result);
		});
	});
};

function retrieveSources(metadataSources)
{
    let repository = process.argv[2]
    let sources = {}
    for (let path in metadataSources) {
        if (metadataSources[path]['content']) {
            sources[path] = {'content': metadataSources[path]['content']}
        } else {
            // TODO try other methods of retrieval
            sources[path] = {'content': fs.readFileSync(repository + '/keccak256/' + metadataSources[path]['keccak256']).toString()}
        }
    }
    return sources
}

(async () => {
    let metadata_raw = (await read(process.stdin)).trim();
    let metadata = JSON.parse(metadata_raw);
    let input = {};
    input['settings'] = metadata['settings'];
    let fileName = '';
    let contractName = '';
    for (fileName in metadata['settings']['compilationTarget'])
        contractName = metadata['settings']['compilationTarget'][fileName];
    delete input['settings']['compilationTarget']
    console.log('Re-compiling ' + fileName + ':' + contractName + ' with Solidity ' + metadata['compiler']['version']);
    console.log('Retrieving compiler...');
    solcjs.loadRemoteVersion('v' + metadata['compiler']['version'], (error, solcjs) => {
        if (error) throw error;

        input['sources'] = retrieveSources(metadata['sources']);
        input['language'] = metadata['language'];
        input['settings']['metadata'] = input['settings']['metadata'] || {}
        delete input['settings']['useLiteralContent'];
        //input['settings']['metadata']['useLiteralContent'] = true;
        input['settings']['outputSelection'] = input['settings']['outputSelection'] || {}
        input['settings']['outputSelection'][fileName] = input['settings']['outputSelection'][fileName] || {}
        input['settings']['outputSelection'][fileName][contractName] = ['evm.bytecode', 'metadata'];
        
        console.log('Compiling...');
        let output = JSON.parse(solcjs.compile(JSON.stringify(input)));
        console.log('Bytecode: ' + output['contracts'][fileName][contractName]['evm']['bytecode']['object'])
        console.log('Metadata: ' + output['contracts'][fileName][contractName]['metadata']);
        if (output['contracts'][fileName][contractName]['metadata'].trim() != metadata_raw)
            console.log('Metadata does NOT match!');
        else
            console.log('Metadata MATCHES!');
        console.log('Bytecode comparison NOT performed - has to be done manually.');
    });
})();
