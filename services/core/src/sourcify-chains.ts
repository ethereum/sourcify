import Web3 from "web3";

const ETHERSCAN_REGEX = "at txn <a href='/tx/(.*?)'";
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSCOUT_REGEX = "transaction_hash_link\" href=\"${BLOCKSCOUT_PREFIX}/tx/(.*?)\"";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";

function getCustomURL(chainName: string, useOwn=false) {
    if (useOwn && process.env.TESTING !== "true") {
        const port = process.env[`NODE_PORT_${chainName.toUpperCase()}`];
        const url = `${process.env.NODE_ADDRESS}:${port}`;
        console.log(`Using own node for ${chainName} at ${url}`);
        return url;
    }
    const id = process.env[`ALCHEMY_ID_${chainName.toUpperCase()}`];
    return `https://eth-${chainName}.alchemyapi.io/v2/${id}`;
}

function createArchiveEndpoint(chainName: string, useOwn=false) {
    return new Web3(getCustomURL(chainName, useOwn));
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
            getCustomURL("mainnet", true)
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("mainnet", true)
    },
    "3": {
        "fullnode": {
            "dappnode": "http://ropsten.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://ropsten.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getCustomURL("ropsten")
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("ropsten")
    },
    "4": {
        "fullnode": {
            "dappnode": "http://rinkeby.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://rinkeby.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getCustomURL("rinkeby", true)
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("rinkeby", true)
    },
    "5": {
        "fullnode": {
            "dappnode": "http://goerli-geth.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://goerli.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getCustomURL("goerli", true)
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("goerli", true)
    },
    "42": {
        "fullnode": {
            "dappnode": "http://kovan.dappnode:8545"
        },
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://kovan.etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            getCustomURL("kovan")
        ],
        "txRegex": ETHERSCAN_REGEX,
        "archiveWeb3": createArchiveEndpoint("kovan"),
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
    "421611": {
        "supported": true,
        "monitored": true,
        "graphQLFetchAddress": "https://rinkeby-indexer.arbitrum.io/graphql"
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
    },
    "40": {
        "supported": true,
        "monitored": false,
        "contractFetchAddress": "https://mainnet.telos.net/v2/explore/evm/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    },
    "41": {
        "supported": true,
        "monitored": false,
        "contractFetchAddress": "https://testnet.telos.net/v2/explore/evm/" + ETHERSCAN_SUFFIX,
        "txRegex": ETHERSCAN_REGEX
    }
}
