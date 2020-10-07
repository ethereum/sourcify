import Web3 from 'web3';
import fetch from 'node-fetch';
import { StringMap } from 'sourcify-core';
const solc: any = require('solc');

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
};

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

    const solcjs: any = await new Promise((resolve, reject) => {
        solc.loadRemoteVersion(`v${version}`, (error: Error, soljson: any) => {
            (error) ? reject(error) : resolve(soljson);
        });
    });

    const compiled: any = solcjs.compile(JSON.stringify(input));
    const output = JSON.parse(compiled);
    const contract: any = output.contracts[fileName][contractName];

    return {
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        metadata: contract.metadata.trim()
    }
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
    let fileName: string = '';
    let contractName: string = '';

    input.settings = metadata.settings;

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

