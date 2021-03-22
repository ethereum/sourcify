import Web3 from "web3";

const ETHERSCAN_REGEX = "at txn <a href='/tx/(.*?)'";
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSCOUT_REGEX = "transaction_hash_link\" href=\"/tx/(.*?)\"";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";
const BLOCKSCOUT_XDAI_REGEX = "transaction_hash_link\" href=\"/xdai/mainnet/tx/(.*?)\"";

function createArchiveEndpoint(hostPrefix: string) {
    return new Web3(`https://${hostPrefix}.alchemyapi.io/v2/${process.env.ALCHEMY_ID}`)
}

export default {
    "1": {
        "fullnode": {
            "dappnode": "http://geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("eth-mainnet")
    },
    "3": {
        "fullnode": {
            "dappnode": "http://ropsten.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://ropsten.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("eth-ropsten")
    },
    "4": {
        "fullnode": {
            "dappnode": "http://rinkeby.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://rinkeby.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("eth-rinkeby")
    },
    "5": {
        "fullnode": {
            "dappnode": "http://goerli-geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://goerli.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": ["https://goerli.infura.io/v3/${INFURA_API_KEY}"],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("eth-goerli")
    },
    "42": {
        "fullnode": {
            "dappnode": "http://kovan.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://kovan.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("eth-kovan")
    },
    "56": {
        "supported": true,
        "monitored": false,
        "contractFetchAddress": "https://bscscan.com/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "97": {
        "supported": true,
        "monitored": false,
        "contractFetchAddress": "https://testnet.bscscan.com/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "100": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://blockscout.com/xdai/mainnet/" + BLOCKSCOUT_SUFFIX,
        "txRegex": BLOCKSCOUT_XDAI_REGEX
    },
    "137": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://explorer-mainnet.maticvigil.com/" + BLOCKSCOUT_SUFFIX,
        "txRegex": BLOCKSCOUT_REGEX
    },
    "42220": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://explorer.celo.org/" + BLOCKSCOUT_SUFFIX,
        "txRegex": BLOCKSCOUT_REGEX
    },
    "44787": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://alfajores-blockscout.celo-testnet.org/" + BLOCKSCOUT_SUFFIX,
        "txRegex": BLOCKSCOUT_REGEX
    },
    "62320": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://baklava-blockscout.celo-testnet.org/" + BLOCKSCOUT_SUFFIX,
        "txRegex": BLOCKSCOUT_REGEX
    },
    "80001": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://explorer-mumbai.maticvigil.com/" + BLOCKSCOUT_SUFFIX,
        "txRegex": BLOCKSCOUT_REGEX
    }
}