import cbor from 'cbor';
import * as chainsRaw from "../chains.json";
import sourcifyChainsRaw from "../sourcify-chains";
import { StringMap, ReformattedMetadata, Chain } from './types';
const chains = chainsRaw as any;
const sourcifyChains = sourcifyChainsRaw as any;

type ChainMap = {
    [chainId: string]: Chain
};

const TEST_CHAINS: Chain[] = [{
    name: "Localhost",
    shortName: "Localhost",
    chainId: 0,
    faucets: [],
    infoURL: null,
    nativeCurrency: null,
    network: "testnet",
    networkId: 0,
    rpc: [ `http://localhost:${process.env.LOCALCHAIN_PORT || 8545}` ],
    supported: true,
    monitored: true,
}];

const chainMap: ChainMap = {};
// Add test chains too if testing
if (process.env.TESTING == "true") {
    for (const chain of TEST_CHAINS) {
        chainMap[chain.chainId.toString()] = chain;
    }
}

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

function filter(obj: ChainMap, predicate: ((c: any) => boolean)): Chain[] {
    const arr = [];
    for (const id in obj) {
        const value = obj[id];
        if (predicate(value)) {
            arr.push(value);
        }
    }
    return arr;
}

export function getSourcifyChains(): Chain[] {
    const chainsArray = filter(chainMap, c => c.supported !== undefined);
    const idToChain = (id: number) => {
        return chainsArray.find((chain) => chain.chainId == id);
    };
    // Have Ethereum chains on top.
    const ethereumChainIds = [1, 3, 4, 5, 42];
    const etherumChains = ethereumChainIds.map((id) => idToChain(id));
    // Others, sorted alphabetically
    const otherChains = chainsArray
        .filter((chain) => ![1, 3, 4, 5, 42].includes(chain.chainId))
        .sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

    const sourcifyChainsSorted = etherumChains.concat(otherChains);
    return sourcifyChainsSorted;
}

export function getSupportedChains(): Chain[] {
    return filter(chainMap, c => c.supported);
}

export function getMonitoredChains(): Chain[] {
    return filter(chainMap, c => c.monitored);
}

export function getTestChains(): Chain[] {
    return TEST_CHAINS;
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

    const solcJsonInput: any = {};
    let fileName = '';
    let contractName = '';

    solcJsonInput.settings = JSON.parse(JSON.stringify(metadata.settings));

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

    delete solcJsonInput.settings.compilationTarget;

    solcJsonInput.sources = {};
    for (const source in sources) {
        solcJsonInput.sources[source] = { content: sources[source] }
    }

    solcJsonInput.language = metadata.language
    solcJsonInput.settings.metadata = solcJsonInput.settings.metadata || {}
    solcJsonInput.settings.outputSelection = solcJsonInput.settings.outputSelection || {}
    solcJsonInput.settings.outputSelection[fileName] = solcJsonInput.settings.outputSelection[fileName] || {}

    solcJsonInput.settings.outputSelection[fileName][contractName] = [
        'evm.bytecode.object',
        'evm.deployedBytecode.object',
        'metadata'
    ];

    solcJsonInput.settings.libraries = { "": metadata.settings.libraries || {} };

    return { solcJsonInput, fileName, contractName };
}