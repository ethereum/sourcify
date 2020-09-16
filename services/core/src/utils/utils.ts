import * as chainOptions from '../chains.json';

export const getChainId = (chain: string): string => {
    for (const chainOption in chainOptions) {
        const network = chainOptions[chainOption].network;
        const chainId = chainOptions[chainOption].chainId;
        if ((network && network.toLowerCase() === chain) || String(chainId) === chain) {
            return String(chainOptions[chainOption].chainId);
        }
    }

    throw new Error(`Chain ${chain} not supported!`);
}

export const getIdFromChainName = (chain: string): number => {
    for (const chainOption in chainOptions) {
        if (chainOptions[chainOption].network === chain) {
            return chainOptions[chainOption].chainId;
        }
    }
    throw new Error("Chain not found!"); //TODO: should we throw an error here or just let it pass?
}

export const getChainByName = (name: string): any => {
    for (const chainOption in chainOptions) {
        const network = chainOptions[chainOption].network;
        if (network && network.toLowerCase() === name) {
            return chainOptions[chainOption];
        }
    }

    throw new Error(`Chain ${name} not supported!`)
}