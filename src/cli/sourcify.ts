// #!/usr/bin/env node

// import { InputData, localChainUrl } from "./utils";
// import fs from 'fs';
// import chalk from 'chalk';
// const clear = require('clear');
// const figlet = require('figlet');
// import path from 'path';
// import Injector from '../server/services/Injector';
// import { Logger } from '../utils/logger/Logger';
// import * as yargs from 'yargs';
// import { FileService } from "../server/services/FileService";
// import { VerificationService } from "../server/services/VerificationService";
// import VerificationController from '../server/controllers/VerificationController';
// import config from "../config";

// clear();
// console.log(
//     chalk.red(
//         figlet.textSync('sourcify cli', {
//             horizontalLayout: 'default',
//             font: 'Banner',
//         }),
//     ),
// );
// console.log("Use this for local verification only!")

// //Use this for local verification only -> at to the description
// const repository: string = './repository';

// const inputData: InputData = {
//     repository: repository,
//     addresses: [],
//     files: [],
//     chain: ""
// }

// interface Arguments {
//     _: string[];
//     [x: string]: unknown;
//     $0: string;
//     files?: (string | number)[] | undefined;
//     address: string,
//     chain: string,
//     repository: string,
//     infura: string
// }

// const argv: Arguments = yargs.options({
//     files: { type: 'array', alias: 'f', description: 'Paths to the files or folders with files you want to verify' },
//     chain: { type: 'string', alias: 'c', demand: true },
//     address: { type: 'string', alias: 'a', demand: true },
//     repository: { type: 'string', alias: 'r', description: 'Path to the directory with verified contracts' },
//     infura: { type: 'string', alias: 'id', description: 'Provide your own Infura project ID' }
// }).argv;

// if (argv.chain) {
//     inputData.chain = argv.chain;
// }

// if (argv.address) {
//     inputData.addresses.push(argv.address);
// }

// if (argv.files) {
//     for (const file in argv.files) {
//         const readFile = fs.readFileSync(path.resolve(argv.files[file].toString()));
//         inputData.files.push(readFile);
//     }
// }

// if (argv.repository) {
//     inputData.repository = argv.repository;
// }

// if (!argv.infura && !process.env.INFURA_ID) {
//     yargs.exit(1, new Error("Please provide infuraID"));
// }

// export const log = Logger("CLI");

// const fileService = new FileService(log);
// const verificationService = new VerificationService(fileService, log);

// async function verify(inputData: any) {
//     const result = await verificationService.findByAddress(inputData.address, inputData.chain, config.repository.path);
//     console.log(result);
// }

// verify(inputData);
