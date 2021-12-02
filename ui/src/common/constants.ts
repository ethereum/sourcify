export const CHAIN_OPTIONS = [
    {value: "mainnet", label: "Ethereum Mainnet", id: 1},
    {value: "ropsten", label: "Ropsten", id: 3},
    {value: "rinkeby", label: "Rinkeby", id: 4},
    {value: "kovan", label: "Kovan", id: 42},
    {value: "goerli", label: "Görli", id: 5},
    {value: "xdai", label: "xDai", id: 100},
    {value: "sokol", label: "Sokol", id: 77},
    {value: "binance smart chain mainnet", label: "Binance Smart Chain Mainnet", id: 56},
    {value: "binance smart chain testnet", label: "Binance Smart Chain Testnet", id: 97},
    {value: "matic mainnet", label: "Polygon (previously Matic)", id: 137},
    {value: "mumbai testnet", label: "Mumbai Testnet (Polygon/Matic)", id: 80001},
    {value: "celo mainnet", label: "Celo Mainnet", id: 42220},
    {value: "alfajores testnet", label: "Celo Alfajores Testnet", id: 44787},
    {value: "baklava testnet", label: "Celo Baklava Testnet", id: 62320},
    {value: "avalanche testnet", label: "Avalanche Fuji Testnet", id: 43113},
    {value: "avalanche mainnet", label: "Avalanche Mainnet", id: 43114},
    {value: "arbitrum one", label: "Arbitrum Mainnet", id: 42161},
    {value: "arbitrum rinkeby", label: "Arbitrum Testnet Rinkeby", id: 421611},
    {value: "telos mainnet", label: "Telos EVM Mainnet", id: 40},
    {value: "telos testnet", label: "Telos EVM Testnet", id: 41},
    {value: "ubiq", label: "Ubiq", id: 8},
    {value: "oneledger testnet", label: "OneLedger Testnet Frankenstein", id: 4216137055},
    {value: "syscoin testnet", label: "Syscoin Tanenbaum Testnet", id: 5700},
    {value: "optimistic mainnet", label: "Optimistic Ethereum Mainnet", id: 10},
    {value: "optimistic kovan", label: "Optimistic Ethereum Testnet Kovan", id: 69},
    {value: "boba network mainnet", label: "Boba Network", id: 288 },
    {value: "boba network rinkeby", label: "Boba Network Rinkeby Testnet", id: 28 },
    {value: "velas", label: "Velas EVM Mainnet", id: 106},
    {value: "meter mainnet", label: "Meter Mainnet", id: 82},
];

export const ID_TO_CHAIN = {};
for (const chainOption of CHAIN_OPTIONS) {
    ID_TO_CHAIN[chainOption.id] = chainOption;
}

export const CHAIN_IDS_STR = CHAIN_OPTIONS.map(chainOption => chainOption.id).join(",");

export const REPOSITORY_URL = process.env.REPOSITORY_URL;
export const SERVER_URL = process.env.SERVER_URL;
export const REPOSITORY_URL_FULL_MATCH = `${REPOSITORY_URL}/contracts/full_match`;
export const REPOSITORY_URL_PARTIAL_MATCH = `${REPOSITORY_URL}/contracts/partial_match`;
export const IPFS_IPNS_GATEWAY_URL = `https://gateway.ipfs.io/ipns/${process.env.IPNS}`;
export const GITTER_URL = `https://gitter.im/ethereum/source-verify`;
export const GITHUB_URL = `https://github.com/ethereum/sourcify`;
export const TWITTER_URL = `https://twitter.com/sourcifyeth`;
export const SOLIDITY_ETHEREUM_URL = `https://solidity.ethereum.org/2020/06/25/sourcify-faq/`;
