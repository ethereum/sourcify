import * as chainOptions from '../chains.json';
import cbor from 'cbor';

function filterChains(predicate: (chain: any) => boolean): Array<any> {
    const filteredChains = [];
    for (const chainOption in chainOptions) {
        const chainOptionValue = chainOptions[chainOption];
        if (predicate(chainOptionValue)) {
            filteredChains.push(chainOptionValue);
        }
    }
    return filteredChains;
}

/**
 * Returns the chains currently supported by Sourcify server.
 * @returns array of chains currently supported by Sourcify server
 */
export function getSupportedChains(): Array<any> {
    return filterChains(c => c.supported);
}

/**
 * Returns the chains currently monitored by Sourcify.
 * @returns array of chains currently monitored by Sourcify
 */
export function getMonitoredChains(): Array<any> {
    return filterChains(c => c.monitored);
}

export function getChainId(chain: string): string {
    for (const chainOption in chainOptions) {
        const network = chainOptions[chainOption].network;
        const chainId = chainOptions[chainOption].chainId;
        if ((network && network.toLowerCase() === chain) || String(chainId) === chain) {
            return String(chainOptions[chainOption].chainId);
        }
    }

    throw new Error(`Chain ${chain} not supported!`);
}

export function getIdFromChainName(chain: string): number {
    for (const chainOption in chainOptions) {
        if (chainOptions[chainOption].network === chain) {
            return chainOptions[chainOption].chainId;
        }
    }
    throw new Error("Chain not found!");
}

export function getChainByName(name: string): any {
    for (const chainOption in chainOptions) {
        const otherName = chainOptions[chainOption].name;
        if (otherName === name) {
            return chainOptions[chainOption];
        }
    }

    throw new Error(`Chain ${name} not supported!`)
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