export const CHAIN_GROUPS = [
    {
        label: "Ethereum",
        chains: [
            {value: "mainnet", label: "Ethereum Mainnet", id: 1},
            {value: "ropsten", label: "Ropsten", id: 3},
            {value: "rinkeby", label: "Rinkeby", id: 4},
            {value: "kovan", label: "Kovan", id: 42},
            {value: "goerli", label: "Görli", id: 5},
        ]
    },
    {
        label: "xDai",
        chains: [
            {value: "xdai", label: "xDai", id: 100},
        ]
    },
    {
        label: "Binance Smart Chain",
        chains: [
            {value: "binance smart chain mainnet", label: "Binance Smart Chain Mainnet", id: 56},
            {value: "binance smart chain testnet", label: "Binance Smart Chain Testnet", id: 97},
        ]
    },
    {
        label: "Polygon (previously Matic)",
        chains: [
            {value: "matic mainnet", label: "Polygon Mainnet", id: 137},
            {value: "mumbai testnet", label: "Mumbai Testnet", id: 80001},
        ]
    },
    {
        label: "Celo",
        chains: [
            {value: "celo mainnet", label: "Celo Mainnet", id: 42220},
            {value: "alfajores testnet", label: "Celo Alfajores Testnet", id: 44787},
            {value: "baklava testnet", label: "Celo Baklava Testnet", id: 62320},
        ]
    }
];

const CHAIN_IDS_ARR = [];
export const ID_TO_CHAIN = {};
for (const chainGroup of CHAIN_GROUPS) {
    for (const chainOption of chainGroup.chains) {
        ID_TO_CHAIN[chainOption.id] = chainOption;
        CHAIN_IDS_ARR.push(chainOption.id);
    }
}

export const CHAIN_IDS_STR = CHAIN_IDS_ARR.join(",");

export const REPOSITORY_URL = process.env.REPOSITORY_URL;
export const SERVER_URL = process.env.SERVER_URL;
export const REPOSITORY_URL_FULL_MATCH = `${REPOSITORY_URL}/contracts/full_match`;
export const REPOSITORY_URL_PARTIAL_MATCH = `${REPOSITORY_URL}/contracts/partial_match`;
export const IPFS_IPNS_GATEWAY_URL = `https://gateway.ipfs.io/ipns/${process.env.IPNS}`;
export const GITTER_URL = `https://gitter.im/ethereum/source-verify`;
export const GITHUB_URL = `https://github.com/ethereum/sourcify`;
export const TWITTER_URL = `https://twitter.com/sourcifyeth`;
export const SOLIDITY_ETHEREUM_URL = `https://solidity.ethereum.org/2020/06/25/sourcify-faq/`;

// API 2
export const SESSION_DATA_URL = `${SERVER_URL}/session-data`;
export const ADD_FILES_URL = `${SERVER_URL}/input-files`;
export const VERIFY_VALIDATED_URL = `${SERVER_URL}/verify-validated`;
export const RESTART_SESSION_URL = `${SERVER_URL}/restart-session`;
