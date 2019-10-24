#!/usr/bin/env node

'use strict';

let process = require('process');
let Web3 = require('web3');
let fs = require('fs');

if (process.argv.length < 4) {
    console.log("Usage: inject_keccak256.js <repository path> <file>")
    process.exit(1)
}

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

(async () => {
    let fileData = fs.readFileSync(process.argv[3]);
    let hash = Web3.utils.keccak256(fileData);
    let path = process.argv[2] + '/keccak256/' + hash;
    fs.writeFileSync(path, fileData);
    console.log("Imported file as " + path);
})();
