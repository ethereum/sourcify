import Web3 from 'web3';
import fetch from 'node-fetch';
import { StringMap, reformatMetadata, InfoErrorLogger } from '@ethereum-sourcify/core';
import Path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require('solc');
import { spawnSync } from 'child_process';
import { StatusCodes } from 'http-status-codes';
import { ethers } from 'ethers';
import promiseAny = require('promise.any'); // use import require to avoid error from typescript see: https://github.com/es-shims/Promise.allSettled/issues/5#issuecomment-723485612

const GITHUB_SOLC_REPO = "https://github.com/ethereum/solc-bin/raw/gh-pages/linux-amd64/";

export interface RecompilationResult {
    creationBytecode: string,
    deployedBytecode: string,
    metadata: string
}

/**
 * Checks if provided endpoint is online
 * @param {string} provider personal project ID from infura.io or real Ethereum node endpoint
 */
export async function checkEndpoint(provider: string): Promise<void> {
    if (provider.includes("http")) {
        const web3 = new Web3(provider);
        await web3.eth.getNodeInfo().catch(() => {
            throw new Error("Check your node");
        })
    } else if (provider) {
        await fetch(`https://eth-mainnet.alchemyapi.io/v2/${provider}`, {
            method: "post",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [] })
        })
            .then((response) => {
                if (response.status == StatusCodes.UNAUTHORIZED) {
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
export async function getBytecode(web3array: Web3[], address: string): Promise<string> {
    address = Web3.utils.toChecksumAddress(address);
    const rpcPromises: Promise<string>[] = [];
    for (const web3 of web3array) {
        rpcPromises.push(web3.eth.getCode(address));
    }
    try {
        // Promise.any for Node v15.0.0<
        return promiseAny([ 
            ...rpcPromises,
            new Promise((_resolve, reject) => {
                setTimeout(() => reject('RPC took too long to respond'), 3e3);
            })
        ])
    } catch (err: any) {
        throw new Error(err);
    }
}

const RECOMPILATION_ERR_MSG = "Recompilation error (probably caused by invalid metadata)";

/**
 * Compiles sources using version and settings specified in metadata
 * @param  {any}                          metadata
 * @param  {string[]}                     sources  solidity files
 * @return {Promise<RecompilationResult>}
 */
export async function recompile(
    metadata: any,
    sources: StringMap,
    log: InfoErrorLogger
): Promise<RecompilationResult> {

    const {
        solcJsonInput,
        fileName,
        contractName
    } = reformatMetadata(metadata, sources, log);

    const loc = "[RECOMPILE]";
    const version = metadata.compiler.version;

    log.info(
        { loc, fileName, contractName, version },
        'Recompiling'
    );

    const compiled = await useCompiler(version, solcJsonInput, log);
    const output = JSON.parse(compiled);
    if (!output.contracts || !output.contracts[fileName] || !output.contracts[fileName][contractName] || !output.contracts[fileName][contractName].evm || !output.contracts[fileName][contractName].evm.bytecode) {
        const errors = output.errors.filter((e: any) => e.severity === "error").map((e: any) => e.message);
        log.error({ loc, fileName, contractName, version, errors });
        throw new Error(RECOMPILATION_ERR_MSG);
    }
    
    const contract: any = output.contracts[fileName][contractName];
    return {
        creationBytecode: `0x${contract.evm.bytecode.object}`,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        metadata: contract.metadata.trim()
    }
}

/**
 * Searches for a solc: first for a local executable version, then from GitHub
 * and then using the getSolcJs function.
 * Once the compiler is retrieved, it is used, and the stringified solc output is returned.
 * 
 * @param version the version of solc to be used for compilation
 * @param input a JSON object of the standard-json format compatible with solc
 * @param log the logger
 * @returns stringified solc output
 */
async function useCompiler(version: string, solcJsonInput: any, log: InfoErrorLogger) {
    const inputStringified = JSON.stringify(solcJsonInput);
    const solcPath = await getSolcExecutable(version, log);
    let compiled: string = null;

    if (solcPath) {
        const logObject = {loc: "[RECOMPILE]", version, solcPath};
        log.info(logObject, "Compiling with external executable");

        const shellOutputBuffer = spawnSync(solcPath, ["--standard-json"], {input: inputStringified});

        // Handle errors.
        if (shellOutputBuffer.error) {
            const typedError: NodeJS.ErrnoException = shellOutputBuffer.error;
            // Handle compilation output size > stdout buffer
            if (typedError.code  === 'ENOBUFS') {
                log.error(logObject, shellOutputBuffer.error || RECOMPILATION_ERR_MSG);
                throw new Error('Compilation output size too large')
            }
            log.error(logObject, shellOutputBuffer.error || RECOMPILATION_ERR_MSG);
            throw new Error('Compilation Error')
        }
        if (!shellOutputBuffer.stdout) {
            log.error(logObject, shellOutputBuffer.error || RECOMPILATION_ERR_MSG);
            throw new Error(RECOMPILATION_ERR_MSG);
        }
        compiled = shellOutputBuffer.stdout.toString();

    } else {
        const soljson = await getSolcJs(version, log);
        compiled = soljson.compile(inputStringified);
    }

    return compiled;
}

function validateSolcPath(solcPath: string, log: InfoErrorLogger): boolean {
    const spawned = spawnSync(solcPath, ["--version"]);
    if (spawned.status === 0) {
        return true;
    }

    const error = spawned.error ? spawned.error.message : "Unknown error";
    log.error({ loc: "[VALIDATE_SOLC_PATH]", solcPath, error });
    return false;
}

async function getSolcExecutable(version: string, log: InfoErrorLogger): Promise<string> {
    const fileName = `solc-linux-amd64-v${version}`;
    const tmpSolcRepo = process.env.SOLC_REPO_TMP || Path.join("/tmp", "solc-repo");

    const repoPaths = [tmpSolcRepo, process.env.SOLC_REPO || "solc-repo"];
    for (const repoPath of repoPaths) {
        const solcPath = Path.join(repoPath, fileName);
        if (fs.existsSync(solcPath) && validateSolcPath(solcPath, log)) {
            return solcPath;
        }
    }

    const tmpSolcPath = Path.join(tmpSolcRepo, fileName);
    const success = await fetchSolcFromGitHub(tmpSolcPath, version, fileName, log);
    return success ? tmpSolcPath : null;
}

async function fetchSolcFromGitHub(solcPath: string, version: string, fileName: string, log: InfoErrorLogger): Promise<boolean> {
    const githubSolcURI = GITHUB_SOLC_REPO + encodeURIComponent(fileName);
    const logObject = {loc: "[RECOMPILE]", version, githubSolcURI};
    log.info(logObject, "Fetching executable solc from GitHub");

    const res = await fetch(githubSolcURI);
    if (res.status === StatusCodes.OK) {
        log.info(logObject, "Successfully fetched executable solc from GitHub");
        fs.mkdirSync(Path.dirname(solcPath), { recursive: true });
        const buffer = await res.buffer();

        try { fs.unlinkSync(solcPath); } catch (_e) { undefined }
        fs.writeFileSync(solcPath, buffer, { mode: 0o755 });
        if (validateSolcPath(solcPath, log)) {
            return true;
        }
    } else {
        log.error(logObject, "Failed fetching executable solc from GitHub");
    }

    return false;
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
export function getSolcJs(version = "latest", log: InfoErrorLogger): Promise<any> {
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
        return new Promise(resolve => {
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

 async function getCreationBlockNumber(contractAddress: string, web3: Web3): Promise<number> {
    let highestBlock = await web3.eth.getBlockNumber();
    let lowestBlock = 0;

    let contractCode = await web3.eth.getCode(contractAddress, highestBlock);
    if (contractCode == "0x") {
        throw new Error(`Contract ${contractAddress} does not exist!`);
    }

    while (lowestBlock <= highestBlock) {
        const searchBlock = Math.floor((lowestBlock + highestBlock) / 2)
        contractCode = await web3.eth.getCode(contractAddress, searchBlock);

        if (contractCode != "0x") {
            highestBlock = searchBlock;
        } else if (contractCode == "0x") {
            lowestBlock = searchBlock;
        }

        if (highestBlock == lowestBlock + 1) {
            return highestBlock;
        }
    }
}

/**
 * Modified and optimized version of https://www.shawntabrizi.com/ethereum-find-contract-creator/
 * 
 * @param contractAddress the hexadecimal address of the contract 
 * @param web3 initialized web3 object for chain requests
 * @returns a Promise of the creation data
 */
export async function getCreationDataFromArchive(contractAddress: string, web3: Web3): Promise<string> {
    const creationBlockNumber = await getCreationBlockNumber(contractAddress, web3);
    const creationBlock = await web3.eth.getBlock(creationBlockNumber, true);
    const transactions = creationBlock.transactions;

    for (const i in transactions) {
        const transaction = transactions[i];

        const calculatedContractAddress = ethers.utils.getContractAddress(transaction);
        if (calculatedContractAddress === contractAddress) {
            return transaction.input;
        }
    }

    throw new Error(`Creation data of contract ${contractAddress} could not be located!`);
}

/**
 * Returns the data used for contract creation in the transaction found by the provided regex on the provided page.
 * 
 * @param fetchAddress the URL from which to fetch the page to be scrapd
 * @param txRegex regex whose first group matches the transaction hash on the page
 * @param web3 initialized web3 object for chain requests
 * @returns a promise of the creation data
 */
export async function getCreationDataByScraping(fetchAddress: string, txRegex: string, web3: Web3): Promise<string> {
    const res = await fetch(fetchAddress);
    const buffer = await res.buffer();
    const page = buffer.toString();
    if (res.status === StatusCodes.OK) {
        const matched = page.match(txRegex);
        if (matched && matched[1]) {
            const txHash = matched[1];
            const tx = await web3.eth.getTransaction(txHash);
            return tx.input;
        }
    }

    throw new Error(`Creation data could not be scraped from ${fetchAddress}`);
}

export async function getCreationDataTelos(fetchAddress: string, web3: Web3): Promise<string> {
    const res = await fetch(fetchAddress);
    if (res.status === StatusCodes.OK) {
        const response = await res.json();
        if (response.creation_trx) {
            const txHash = response.creation_trx;
            const tx = await web3.eth.getTransaction(txHash);
            return tx.input;
        }
    }

    throw new Error(`Creation data could not be scraped from ${fetchAddress}`);
}


export async function getCreationDataFromGraphQL(fetchAddress: string, contractAddress: string, web3: Web3): Promise<string> {
    const body = JSON.stringify({ query: `
        query AccountCreationTx {
        allAccounts(first:1, filter: {
            address:{
            equalTo:"${contractAddress.toLowerCase()}"
            },
            creationTx: {
            isNull: false
            }
        }) {
            nodes {
            creationTx
            }
        }
        }`
    });

    const rawResponse = await fetch(fetchAddress, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body
    });

    try {
        const resp = await rawResponse.json();
        const txHash = resp.data.allAccounts.nodes[0].creationTx;
        const tx = await web3.eth.getTransaction(txHash);
        return tx.input;
    } catch (err: any) {
        throw new Error(`Creation data could not be fetched from ${fetchAddress}, reason: ${err.message}`);
    }
}
