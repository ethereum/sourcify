#!/usr/bin/env node

import util from 'util';
import fs from 'fs';
import path from 'path';
import Web3 from 'web3';

const fileNames = process.argv.slice(2);

let files: any[] = [];
fileNames.forEach(fileName => {

    try {
        files.push({
            name: fileName,
            data: fs.readFileSync(path.resolve(fileName))
        })
    } catch (error) {
        throw new Error("Can not read file " + fileName);
    }

});

export function checkFiles(files: any) {
    const sanitizedFiles = sanitizeInputFiles(findInputFiles(files))
    const metadataFiles = findMetadataFiles(sanitizedFiles);
    let sources: any = [];

    metadataFiles.forEach(metadata => {
        sources.push(rearrangeSources(metadata, sanitizedFiles));
    });

    return {
        metadataFiles: metadataFiles,
        sources: sources
    }
}

export function organizeFilesForSubmition(files: any){
    const f = findInputFiles(files);
    return sanitizeInputFiles(f);
}

function findInputFiles(files: any): any {
    const inputs: any = [];

    files.forEach((file: { data: any; }) => {
        inputs.push(file.data)
    })
    if (inputs) {
        return inputs;
    }

    // Case: default
    const msg = `Invalid file(s) detected: ${util.inspect(files.files)}`;
    throw new Error(msg);
}

function sanitizeInputFiles(inputs: any): string[] {
    const files = [];
    if (!inputs.length) {
        const msg = 'Unable to extract any files. Your request may be misformatted ' +
            'or missing some contents.';

        throw new Error(msg);

    }

    for (const data of inputs) {
        try {
            const val = JSON.parse(data.toString());
            const type = Object.prototype.toString.call(val);

            (type === '[object Object]')
                ? files.push(JSON.stringify(val))  // JSON formatted metadata
                : files.push(val);                 // Stringified metadata

        } catch (err) {
            files.push(data.toString())          // Solidity files
        }

    }
    return files;
}

function findMetadataFiles(files: string[]): any[] {
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

    if (!metadataFiles.length) {
        throw new Error("Metadata file not found. Did you include \"metadata.json\"?");
    }

    return metadataFiles;
}

function rearrangeSources(metadata: any, files: string[]): StringMap {
    const sources: StringMap = {}
    const byHash = storeByHash(files);

    for (const fileName in metadata.sources) {
        let content: string = metadata.sources[fileName].content;
        const hash: string = metadata.sources[fileName].keccak256;
        if (content) {
            if (Web3.utils.keccak256(content) != hash) {
                throw new Error(`Invalid content for file ${fileName}`);
            }
        } else {
            content = byHash[hash];
        }
        if (!content) {
            throw new Error(`The metadata file mentions a source file called "${fileName}" ` +
                `that cannot be found in your upload.\nIts keccak256 hash is ${hash}. ` +
                `Please try to find it and include it in the upload.`);
        }
        sources[fileName] = content;
    }
    return sources
}

function storeByHash(files: string[]): StringMap {
    const byHash: StringMap = {};

    for (const i in files) {
        byHash[Web3.utils.keccak256(files[i])] = files[i]
    }
    return byHash;
}

declare interface StringMap {
    [key: string]: string;
}