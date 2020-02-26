#!/usr/bin/env node

'use strict';

if (process.argv.length < 3) {
    console.log("Usage: validator.js <file paths>")
    process.exit(1)
}

const fs = require('fs');

let injector = require('./injector');

function loadFiles(filePaths){
    let files = [];
    filePaths.forEach((filePath) => {
        let file = fs.readFileSync(filePath);
        try {
            let parsed = JSON.parse(file.toString()); //This is json
            files.push(parsed);
        } catch (e) {
            files.push(file.toString())
        }
    });
    return files;
}

let run = async function(filePaths) {
    try {
        filePaths.splice(0,2); //Remove first two elements as it's node path and this files path
        let files = loadFiles(filePaths);
        let result = await injector.validate(files);
        console.log(`Validation successful`);
    } catch(error){
        console.log(`Validation failed: ${error}`);
    }
    process.exit(0)
}

run(process.argv).catch(console.log);
