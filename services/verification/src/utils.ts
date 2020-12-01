import Web3 from 'web3';
import fetch from 'node-fetch';
import { StringMap } from '@ethereum-sourcify/core';
import Path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require('solc');
import {spawnSync} from 'child_process';

export interface RecompilationResult {
    bytecode: string,
    deployedBytecode: string,
    metadata: string
}

export declare interface ReformattedMetadata {
    input: any,
    fileName: string,
    contractName: string
}

/**
 * Checks if provided endpoint is online
 * @param {string} provider personal project ID from infura.io or real Ethereum node endpoint
 */
export async function checkEndpoint(provider: string) {
    if (provider.includes("http")) {
        const web3 = new Web3(provider);
        await web3.eth.getNodeInfo().catch(() => {
            throw new Error("Check your node");
        })
    } else if (provider) {
        await fetch(`https://mainnet.infura.io/v3/${provider}`, {
            method: "post",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [] })
        })
            .then((response) => {
                if (response.status == 401) {
                    throw new Error("Check your Infura ID");
                }
            }).catch(() => {
                throw new Error("Check your Infura ID");
            });
    } else {
        throw new Error("No provider set");
    }
}

/**
 * Wraps eth_getCode
 * @param {Web3}   web3    connected web3 instance
 * @param {string} address contract
 */
export async function getBytecode(web3: Web3, address: string) {
    address = web3.utils.toChecksumAddress(address);
    return await web3.eth.getCode(address);
}

/**
 * Compiles sources using version and settings specified in metadata
 * @param  {any}                          metadata
 * @param  {string[]}                     sources  solidity files
 * @return {Promise<RecompilationResult>}
 */
export async function recompile(
    metadata: any,
    sources: StringMap,
    log: any
): Promise<RecompilationResult> {

    const {
        input,
        fileName,
        contractName
    } = reformatMetadata(metadata, sources, log);

    const version = metadata.compiler.version;

    log.info(
        {
            loc: '[RECOMPILE]',
            fileName: fileName,
            contractName: contractName,
            version: version
        },
        'Recompiling'
    );

    const compiled = await useCompiler(version, input, log);
    const output = JSON.parse(compiled);
    const contract: any = output.contracts[fileName][contractName];

    return {
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        metadata: contract.metadata.trim()
    }
}

/**
 * Searches for a solc: first for a local executable version, then using the getSolc function.
 * Once the compiler is retrieved, it is used, and the stringified solc output is returned.
 * 
 * @param version the version of solc to be used for compilation
 * @param input a JSON object of the standard-json format compatible with solc
 * @param log the logger
 * @returns stringified solc output
 */
async function useCompiler(version: string, input: any, log: {info: any, error: any}) {
    const inputStringified = JSON.stringify(input);
    const repoPath = process.env.SOLC_REPO || "solc-repo";
    const solcPath = Path.join(repoPath, `solc-linux-amd64-v${version}`);
    let compiled: string = null;

    if (fs.existsSync(solcPath)) {
        log.info({loc: "[RECOMPILE]", version, solcPath}, "Compiling with external executable");
        const shellOutputBuffer = spawnSync(solcPath, ["--standard-json"], {input: inputStringified});
        compiled = shellOutputBuffer.stdout.toString();
    } else {
        const soljson = await getSolc(version, log);
        compiled = soljson.compile(inputStringified);
    }

    return compiled;
}

/**
 * Removes post-fixed metadata from a bytecode string
 * (for partial bytecode match comparisons )
 * @param  {string} bytecode
 * @return {string}          bytecode minus metadata
 */
export function getBytecodeWithoutMetadata(bytecode: string): string {
    // Last 4 chars of bytecode specify byte size of metadata component,
    const metadataSize = parseInt(bytecode.slice(-4), 16) * 2 + 4;
    return bytecode.slice(0, bytecode.length - metadataSize);
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
function reformatMetadata(
    metadata: any,
    sources: StringMap,
    log: any
): ReformattedMetadata {

    const input: any = {};
    let fileName = '';
    let contractName = '';

    input.settings = metadata.settings;

    // this assumes that the size of copmilationTarget is 1
    for (fileName in metadata.settings.compilationTarget) {
        contractName = metadata.settings.compilationTarget[fileName];
    }

    delete input['settings']['compilationTarget']

    if (contractName == '') {
        const err = new Error("Could not determine compilation target from metadata.");
        log.info({ loc: '[REFORMAT]', err: err });
        throw err;
    }

    input['sources'] = {}
    for (const source in sources) {
        input.sources[source] = { 'content': sources[source] }
    }

    input.language = metadata.language
    input.settings.metadata = input.settings.metadata || {}
    input.settings.outputSelection = input.settings.outputSelection || {}
    input.settings.outputSelection[fileName] = input.settings.outputSelection[fileName] || {}

    input.settings.outputSelection[fileName][contractName] = [
        'evm.bytecode',
        'evm.deployedBytecode',
        'metadata'
    ];

    return {
        input: input,
        fileName: fileName,
        contractName: contractName
    }
}


/**
 * Fetches the requested version of the Solidity compiler (soljson).
 * First attempts to search locally; if that fails, falls back to downloading it.
 * 
 * @param version the solc version to retrieve: the expected format is
 * 
 * "[v]<major>.<minor>.<patch>+commit.<hash>"
 * 
 * e.g.: "0.6.6+commit.6c089d02"
 * 
 * defaults to "latest"
 * 
 * @param log a logger to track the course of events
 * 
 * @returns the requested solc instance
 */
export function getSolc(version = "latest", log: {info: any, error: any}): Promise<any> {
    // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
    version = version.trim();
    if (version !== "latest" && !version.startsWith("v")) {
        version = "v" + version;
    }

    const soljsonRepo = process.env.SOLJSON_REPO || "soljson-repo";
    const soljsonPath = Path.resolve(soljsonRepo, `soljson-${version}.js`);
    log.info({loc: "[GET_SOLC]", "target": soljsonPath}, "Searching for js solc locally");

    if (fs.existsSync(soljsonPath)) {
        log.info({loc: "[GET_SOLC]"}, "Found js solc locally");
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const soljson = solc.setupMethods(require(soljsonPath));
            resolve(soljson);
        });
    }

    log.info({loc: "[GET_SOLC]", version}, "Searching for js solc remotely");

    return new Promise((resolve, reject) => {
        solc.loadRemoteVersion(version, (error: Error, soljson: any) => {
            if (error) {
                log.error({loc: "[GET_SOLC]", version}, "Could not find solc remotely");
                reject(error);
            } else {
                log.info({loc: "[GET_SOLC]", version}, "Found solc remotely");
                resolve(soljson);
            }
        });
    });
}