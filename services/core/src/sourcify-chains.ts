import Web3 from "web3";

const ETHERSCAN_REGEX = "at txn <a href='/tx/(.*?)'";
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSCOUT_REGEX = "transaction_hash_link\" href=\"${BLOCKSCOUT_PREFIX}/tx/(.*?)\"";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";

function getAlchemyURL(hostPrefix: string) {
    return `https://${hostPrefix}.alchemyapi.io/v2/${process.env.ALCHEMY_ID}`;
}

function createAlchemyEndpoint(hostPrefix: string) {
    return new Web3(getAlchemyURL(hostPrefix));
}

function getBlockscoutRegex(blockscoutPrefix="") {
    return BLOCKSCOUT_REGEX.replace("${BLOCKSCOUT_PREFIX}", blockscoutPrefix);
}

export default {
    "1": {
        "fullnode": {
            "dappnode": "http://geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getAlchemyURL("eth-mainnet")
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createAlchemyEndpoint("eth-mainnet")
    },
    "3": {
        "fullnode": {
            "dappnode": "http://ropsten.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://ropsten.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getAlchemyURL("eth-ropsten")
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createAlchemyEndpoint("eth-ropsten")
    },
    "4": {
        "fullnode": {
            "dappnode": "http://rinkeby.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://rinkeby.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            process.env.TESTING === "true" ?
            getAlchemyURL("eth-rinkeby") :
            `${process.env.NODE_ADDRESS}:${process.env.NODE_PORT_RINKEBY}`
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createAlchemyEndpoint("eth-rinkeby")
    },
    "5": {
        "fullnode": {
            "dappnode": "http://goerli-geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://goerli.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            process.env.TESTING === "true" ?
            getAlchemyURL("eth-goerli") :
            `${process.env.NODE_ADDRESS}:${process.env.NODE_PORT_GOERLI}`
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createAlchemyEndpoint("eth-goerli")
    },
    "42": {
        "fullnode": {
            "dappnode": "http://kovan.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://kovan.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getAlchemyURL("eth-kovan")
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createAlchemyEndpoint("eth-kovan"),
    },
    "56": {
        "supported": true,
        "monitored": false,
        "contractFetchAddress": "https://bscscan.com/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "77": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://blockscout.com/poa/sokol/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex("/poa/sokol")
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
        "txRegex": getBlockscoutRegex("/xdai/mainnet")
    },
    "137": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://explorer-mainnet.maticvigil.com/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    },
    "42220": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://explorer.celo.org/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    },
    "44787": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://alfajores-blockscout.celo-testnet.org/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    },
    "62320": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://baklava-blockscout.celo-testnet.org/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    },
    "80001": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://explorer-mumbai.maticvigil.com/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    },
    "43113": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://cchain.explorer.avax-test.network/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    },
    "43114": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://cchain.explorer.avax.network/" + BLOCKSCOUT_SUFFIX,
        "txRegex": getBlockscoutRegex()
    }
}
