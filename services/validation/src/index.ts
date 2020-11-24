#!/usr/bin/env node
import program from 'commander';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version, bin } = require("../package.json");
const name = Object.keys(bin)[0];
import { ValidationService, IValidationService } from './ValidationService';
import { CheckedContract } from '@ethereum-sourcify/core';
export * from './ValidationService';

const NAME_DELIMITER = ":";
function parseRecompilationTarget(input: string) {
    const delimiterIndex = input.indexOf(NAME_DELIMITER);
    if (delimiterIndex === -1) {
        return input;
    }

    return {path: input.slice(0, delimiterIndex), name: input.slice(delimiterIndex+1)};
}

function matches(contract: CheckedContract, recompilationTarget: any): boolean {
    if (!recompilationTarget) {
        return false;
    }

    if (typeof recompilationTarget === "string") {
        if (recompilationTarget === contract.name || recompilationTarget === contract.compiledPath) {
            return true;
        }
        return false;
    }

    const nameMatches = recompilationTarget.name === contract.name;
    const pathMatches = recompilationTarget.path === contract.compiledPath;
    return nameMatches && pathMatches;
}

function logOutput(recompilableContracts: CheckedContract[], programOptions: any) {
    switch (recompilableContracts.length) {
        case 0: {
            console.log(`Could not find the ${OPTION_NAME} target: ${programOptions.prepareJson}`);
            process.exitCode = 1;
            break;
        }
        case 1: {
            const standardJson = recompilableContracts[0].getStandardJson(programOptions.settings);
            const prettifiedStandardJson = JSON.stringify(standardJson, null, programOptions.pretty ? 2 : undefined);
            console.log(prettifiedStandardJson);
            break;
        }
        default: {
            console.log(`Ambiguous ${OPTION_NAME} target: ${programOptions.prepareJson}`);
            console.log(`${recompilableContracts.length} instances encountered.`);
            process.exitCode = 1;
            break;
        }
    }
}

const OPTION_NAME = "prepare-json";
program
    .name(name)
    .helpOption("-h, --help", "Output the help message.")
    .version(version, "-v, --version", "Output the current version.")
    .description("A tool that validates smart contracts contained in the provided files, directories and zip archives.")
    .usage("[options] <path>...")
    .option(
        `-j, --${OPTION_NAME} <path:name>`,
        "Output only a JSON object to be used as standard-json input to solc.\n" +
        "The expected argument ought to be of the form path:name; ommiting any of the two is tolerated if unambiguous.\n" +
        `E.g. \`${name} --${OPTION_NAME} foo/bar/Contract.sol:ContractName path/to/dir path/to/zip\`\n`
    )
    .option(
        "-S, --no-settings",
        "Omit the original settings when preparing a standard-json.\n" +
        `Only available with the --${OPTION_NAME} option\n`,
        true
    )
    .option(
        "-p, --pretty",
        "Output the standard json in a pretty format.\n" +
        `Only available with the --${OPTION_NAME} option\n`
    );

if (require.main === module) {
    program.parse(process.argv);
    const fileNames = program.args; // what's left from process.argv
    const fileNamesJoint = fileNames.join(" ");
    if (!fileNames.length) {
        program.help();
    }

    const recompilationTarget =
        program.prepareJson ? parseRecompilationTarget(program.prepareJson) : program.prepareJson;
    
    const validationService: IValidationService = new ValidationService();
    let checkedContracts: CheckedContract[] = [];
    const ignoring: any[] = [];
    try {
        checkedContracts = validationService.checkPaths(fileNames, ignoring);
    } catch (err) {
        console.log(err.message);
        process.exitCode = 1;
    }
    
    const recompilableContracts: CheckedContract[] = [];
    const contractMessages: string[] = [];
    let invalidContracts = 0;
    checkedContracts.forEach(contract => {
        if (matches(contract, recompilationTarget)) {
            if (contract.isValid()) {
                recompilableContracts.push(contract);
            } else {
                console.log(contract.info);
                console.log(`The ${OPTION_NAME} target is not a valid contract! Exiting.`);
                process.exit(1);
            }
        } else if (recompilationTarget === undefined) {
            let msg = contract.info; // should be without a trailing newline
            if (contract.isValid()) {
                msg += "\n";
                msg += `  To recompile, use: \`${name} --${OPTION_NAME} ${contract.compiledPath}:${contract.name} ${fileNamesJoint}`;
                msg += ` | solc --standard-json\``;
            } else {
                invalidContracts++;
            }
            contractMessages.push(msg);
        }
    });

    if (contractMessages.length) {
        console.log(contractMessages.join("\n\n"));
    }

    if (recompilationTarget !== undefined) {
        logOutput(recompilableContracts, program.opts());

    } else if (ignoring.length) {
        console.log("\nFiles ignored due to readability issues:");
        ignoring.forEach(ignored => console.log("  "+ignored));
    }

    if (invalidContracts > 0) {
        process.exitCode = 1;
    }
}
