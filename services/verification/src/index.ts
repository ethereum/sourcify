#!/usr/bin/env node

const solc: any = require('solc');
import fs from 'fs';
import path from 'path';
import { VerificationService } from './services/VerificationService';
import { InputData } from 'sourcify-core/build';

if (process.argv.length > 2) {
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

    const verificationService = new VerificationService();

    //TODO:
    // const inputData: InputData = {
    //     repository: config.repository.path,
    //     addresses: [req.body.address],
    //     chain: chain
    // }

    // verificationService.inject(inputData);

}

