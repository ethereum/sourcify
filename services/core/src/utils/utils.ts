import cbor from 'cbor';
import * as chainsRaw from "../chains.json";
import sourcifyChainsRaw from "../sourcify-chains";
import { StringMap, ReformattedMetadata, Chain } from './types';
const chains = chainsRaw as any;
const sourcifyChains = sourcifyChainsRaw as any;

type ChainMap = {
    [chainId: string]: Chain
};

const chainMap: ChainMap = {};
for (const i in chains) {
    const chain = chains[i];
    const chainId = chain.chainId;
    if (chainId in chainMap) {
        const err = `Corrupt chains file (chains.json): multiple chains have the same chainId: ${chainId}`;
        throw new Error(err);
    }

    if (chainId in sourcifyChains) {
        const sourcifyData = sourcifyChains[chainId];
        Object.assign(chain, sourcifyData);
    }

    chainMap[chainId] = chain;
}

function filter(obj: any, predicate: ((c: any) => boolean)): any[] {
    const arr = [];
    for (const id in obj) {
        const value = obj[id];
        if (predicate(value)) {
            arr.push(value);
        }
    }
    return arr;
}

const supportedChains = filter(chainMap, c => c.supported);
const monitoredChains = filter(chainMap, c => c.monitored);
const fullnodeChains = filter(chainMap, c => c.fullnode);

const TEST_CHAINS: Chain[] = [{
    name: "Localhost",
    shortName: "Localhost",
    chainId: 0,
    faucets: [],
    infoURL: null,
    nativeCurrency: null,
    network: "testnet",
    networkId: 0,
    rpc: [ `http://localhost:${process.env.LOCALCHAIN_PORT || 8545}` ]
}];

/**
 * Returns the chains currently supported by Sourcify server.
 * @returns array of chains currently supported by Sourcify server
 */
export function getSupportedChains(testing = false): Chain[] {
    return testing ? TEST_CHAINS : supportedChains;
}

/**
 * Returns the chains currently monitored by Sourcify.
 * @returns array of chains currently monitored by Sourcify
 */
export function getMonitoredChains(testing = false): Chain[] {
    return testing ? TEST_CHAINS : monitoredChains;
}

/**
 * Returns the chains with additional means
 */
export function getFullnodeChains(): Chain[] {
    return fullnodeChains;
}

/**
 * Checks whether the provided chain identifier is a legal chainId.
 * Throws if not.
 * 
 * @returns the same provided chainId if valid
 * @throws Error if not a valid chainId
 * @param chain chain
 */
export function getChainId(chain: string): string {
    if (!(chain in chainMap)) {
        throw new Error(`Chain ${chain} not supported!`);
    }

    return chain;
}

/**
 * Extracts cbor encoded segement from bytecode
 * @example
 *   const bytes = Web3.utils.hexToBytes(evm.deployedBytecode);
 *   cborDecode(bytes);
 *   > { ipfs: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq" }
 *
 * @param  {number[]} bytecode
 * @return {any}
 */
export function cborDecode(bytecode: number[]): any {
    const cborLength: number = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1];
    const bytecodeBuffer = Buffer.from(bytecode.slice(bytecode.length - 2 - cborLength, -2));
    return cbor.decodeFirstSync(bytecodeBuffer);
}

/**
 * Checks whether the provided object contains any keys or not.
 * @param obj The object whose emptiness is tested.
 * @returns true if any keys present; false otherwise
 */
export function isEmpty(obj: object): boolean {
    return !Object.keys(obj).length && obj.constructor === Object;
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
export function reformatMetadata(
    metadata: any,
    sources: StringMap,
    log?: any
): ReformattedMetadata {

    const input: any = {};
    let fileName = '';
    let contractName = '';

    input.settings = JSON.parse(JSON.stringify(metadata.settings));

    if (!metadata.settings ||
        !metadata.settings.compilationTarget ||
        Object.keys(metadata.settings.compilationTarget).length != 1
    ) {
        const err = "Invalid compilationTarget";
        if (log) log.error({ loc: "REFORMAT", err });
        throw new Error(err);
    }

    for (fileName in metadata.settings.compilationTarget) {
        contractName = metadata.settings.compilationTarget[fileName];
    }

    delete input.settings.compilationTarget;

    input.sources = {};
    for (const source in sources) {
        input.sources[source] = { content: sources[source] }
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

    input.settings.libraries = { "": metadata.settings.libraries || {} };

    return { input, fileName, contractName };
}