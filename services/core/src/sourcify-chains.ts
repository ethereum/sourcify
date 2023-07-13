import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({path: path.resolve(__dirname, "..", "..", "..", "environments/.env")});

const ETHERSCAN_REGEX = (/at txn\s+<a href='\/tx\/(.*?)'/).source; // save as string to be able to return the txRegex in /chains response. If stored as RegExp returns {}
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSCOUT_REGEX = "transaction_hash_link\" href=\"${BLOCKSCOUT_PREFIX}/tx/(.*?)\"";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";
const TELOS_SUFFIX = "v2/evm/get_contract?contract=${ADDRESS}";
const METER_SUFFIX = "api/accounts/${ADDRESS}"

type ChainGroup = "eth" | "polygon";

function buildAlchemyURL(chainName: string, chainGroup: ChainGroup, useOwn = false) {
    if (useOwn && process.env.TESTING !== "true") {
        const port = process.env[`NODE_PORT_${chainName.toUpperCase()}`];
        const url = `${process.env.NODE_ADDRESS}:${port}`;
        return url;
    }

    const id = process.env[`ALCHEMY_ID_${chainGroup.toUpperCase()}_${chainName.toUpperCase()}`];
    const domain = {
        eth: "alchemyapi.io",
        polygon: "g.alchemy.com"
    }[chainGroup];
    return `https://${chainGroup}-${chainName}.${domain}/v2/${id}`;
}
// replaces INFURA_API_KEY in https://networkname.infura.io/v3/{INFURA_API_KEY}
function replaceInfuraID(infuraURL: string) {
    return infuraURL.replace("{INFURA_API_KEY}", process.env.INFURA_ID)
}
function getBlockscoutRegex(blockscoutPrefix = "") {
    return BLOCKSCOUT_REGEX.replace("${BLOCKSCOUT_PREFIX}", blockscoutPrefix);
}

export default {
    "1": {
        "supported": true,
        "monitored": true,
        "contractFetchAddress": "https://etherscan.io/" + ETHERSCAN_SUFFIX,
        "rpc": [
            buildAlchemyURL("mainnet", "eth", true),
            buildAlchemyURL("mainnet", "eth")
        ],
        "txRegex": ETHERSCAN_REGEX,
    },
    "44": {
        "fullnode": {
            "dappnode": "https://crab-rpc.darwinia.network"
        },
        "contractFetchAddress": "https://crab.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "rpc": ["https://crab-rpc.darwinia.network"],
        "supported": true,
        "monitored": false,
    },
    "46": {
        "rpc": ["https://rpc.darwinia.network/"],
        "contractFetchAddress": "https://darwinia.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
    "592": {
        "rpc": ["https://rpc.astar.network:8545"],
        "contractFetchAddress": "https://astar.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
    "336": {
        "rpc": ["https://shiden.api.onfinality.io/public"],
        "contractFetchAddress": "https://shiden.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
    "81": {
        "rpc": ["https://rpc.shibuya.astar.network:8545"],
        "contractFetchAddress": "https://shibuya.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
    "1284": { // Moonbeam
        "rpc": ["https://moonbeam.api.onfinality.io/public"],
        "contractFetchAddress": "https://moonbeam.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false
    },
    "1285": { // Moonriver
        "rpc": ["https://moonriver.api.onfinality.io/public"],
        "contractFetchAddress": "https://moonriver.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false
    },
    "1287": { // Moonbase
        "rpc": ["https://moonbeam-alpha.api.onfinality.io/public"],
        "contractFetchAddress": "https://moonbase.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false
    },
    "2043": {
        "rpc": ["https://astrosat-parachain-rpc.origin-trail.network"],
        "contractFetchAddress": "https://origintrail.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
    "20430": {
        "rpc": ["https://lofar-testnet.origin-trail.network"],
        "contractFetchAddress": "https://origintrail-testnet.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
    "424242": {
        "rpc": ["https://erpc-krest.peaq.network/"],
        "contractFetchAddress": "https://krest.api.subscan.io/api/scan/evm/contract",
        "subscan":true,
        "supported": true,
        "monitored": false,
    },
}
