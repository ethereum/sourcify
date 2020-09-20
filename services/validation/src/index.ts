#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { ValidationService, CheckFileResponse } from './services/ValidationService';

if (process.argv.length > 2) {
    const fileNames = process.argv.slice(2);

    const files: any[] = [];
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

    const validationService = new ValidationService();
    const response: CheckFileResponse = validationService.checkFiles(files);
    console.log(JSON.stringify(response));
}
