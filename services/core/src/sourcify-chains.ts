const ETHERSCAN_REGEX = "at txn <a href='/tx/(.*?)'";
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSCOUT_REGEX = "transaction_hash_link\" href=\"/tx/(.*?)\"";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";

class SourcifyChain {
    
}

export default {
    "1": {
        "fullnode": {
            "dappnode": "http://geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "3": {
        "fullnode": {
            "dappnode": "http://ropsten.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://ropsten.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "4": {
        "fullnode": {
            "dappnode": "http://rinkeby.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://rinkeby.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "5": {
        "fullnode": {
            "dappnode": "http://goerli-geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://goerli.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "42": {
        "fullnode": {
            "dappnode": "http://kovan.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://kovan.etherscan.io/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
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
        "txRegex": "transaction_hash_link\" href=\"/xdai/mainnet/tx/(.*?)\""
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