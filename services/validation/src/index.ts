#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { ValidationService, IValidationService } from './ValidationService';
export * from './ValidationService';

/**
 * Recursively traverses the structure of the provided file. If a regular file, it is added to the
 * files array, if a directory, the same procedure is applied to its children.
 * If a file cannot be read, it is added to the ignoring array.
 * 
 * @param fileName file to be added
 * @param files array where the file will be added
 * @param ignoring array containing the names of ignored files
 */
function attemptAdding(fileName: string, files: Buffer[], ignoring: string[]): void {
    try {
        if (fs.lstatSync(fileName).isFile()) {
            const data = fs.readFileSync(path.resolve(fileName));
            files.push(data);
        }
    } catch (err) {
        console.log(`Cannot read "${fileName}"; proceeding without it.`);
        ignoring.push(fileName);
        return;
    }

    try {
        if (fs.lstatSync(fileName).isDirectory()) {
            const children = fs.readdirSync(fileName);
            for (const child of children) {
                const childJoint = path.join(fileName, child);
                attemptAdding(childJoint, files, ignoring);
            }
        }
    } catch (err) {
        console.log(`"${fileName}" is neither a file nor a directory; proceeding without it.`);
        ignoring.push(fileName);
        return;
    }
}

if (process.argv.length > 2) {
    const fileNames = process.argv.slice(2);

    const files: any[] = [];
    const ignoring: any[] = [];
    fileNames.forEach(fileName => {
        attemptAdding(fileName, files, ignoring);
    });
    
    if (!files.length) {
        console.log("No valid files to continue with... Exiting.");
        process.exit(1);
    }

    const validationService: IValidationService = new ValidationService();
    try {
        const checkedContracts = validationService.checkFiles(files);
        checkedContracts.forEach(contract => {
            console.log(contract.info);
            console.log("");
        });
    } catch (err) {
        console.log(err.message);
    }

    if (ignoring.length) {
        console.log("Files ignored due to readability issues:");
        ignoring.forEach(ignored => console.log("\t"+ignored));
    }
}
