import * as dotenv from "dotenv";
import path from "path";
import { SourcifyEventManager } from "./services/EventManager";

dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", "environments/.env"),
});

const ETHERSCAN_REGEX = /at txn\s+<a href='\/tx\/(.*?)'/.source; // save as string to be able to return the txRegex in /chains response. If stored as RegExp returns {}
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSSCAN_SUFFIX = "api/accounts/${ADDRESS}";
const BLOCKSCOUT_REGEX =
  'transaction_hash_link" href="${BLOCKSCOUT_PREFIX}/tx/(.*?)"';
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";
const TELOS_SUFFIX = "v2/evm/get_contract?contract=${ADDRESS}";
const METER_SUFFIX = "api/accounts/${ADDRESS}";
const AVALANCHE_SUBNET_SUFFIX = "address/${ADDRESS}/contract";

type ChainName = "eth" | "polygon" | "arb" | "opt";

interface SourcifyChain {
  supported: boolean;
  monitored: boolean;
  rpc?: string[];
  txRegex?: string;
  contractFetchAddress?: string;
}
interface SourcifyChainsObject {
  [chainId: string]: SourcifyChain;
}

/**
 *
 * @param chainName - "eth", "polygon" etc.
 * @param chainGroup "mainnet", "goerli"...
 * @param useOwn Use the local node
 * @returns
 */
function buildAlchemyAndCustomRpcURLs(
  chainSubName: string,
  chainName: ChainName,
  useOwn = false
) {
  const rpcURLs: string[] = [];

  if (useOwn) {
    const url = process.env[`NODE_URL_${chainSubName.toUpperCase()}`];
    if (url) {
      rpcURLs.push(url);
    } else {
      SourcifyEventManager.trigger("Core.Error", {
        message: `Environment variable NODE_URL_${chainSubName.toUpperCase()} not set!`,
      });
    }
  }

  let alchemyId;
  switch (chainName) {
    case "opt":
      alchemyId =
        process.env["ALCHEMY_ID_OPTIMISM"] || process.env["ALCHEMY_ID"];
      break;
    case "arb":
      alchemyId =
        process.env["ALCHEMY_ID_ARBITRUM"] || process.env["ALCHEMY_ID"];
      break;
    default:
      alchemyId = process.env["ALCHEMY_ID"];
      break;
  }

  if (!alchemyId)
    SourcifyEventManager.trigger("Core.Error", {
      message: `Environment variable ALCHEMY_ID not set for ${chainName} ${chainSubName}!`,
    });

  const domain = "g.alchemy.com";
  // No sepolia support yet
  if (alchemyId && chainSubName !== "sepolia")
    rpcURLs.push(
      `https://${chainName}-${chainSubName}.${domain}/v2/${alchemyId}`
    );

  return rpcURLs;
}
// replaces INFURA_API_KEY in https://networkname.infura.io/v3/{INFURA_API_KEY}
function replaceInfuraID(infuraURL: string) {
  return infuraURL.replace("{INFURA_API_KEY}", process.env.INFURA_ID || "");
}
function getBlockscoutRegex(blockscoutPrefix = "") {
  return BLOCKSCOUT_REGEX.replace("${BLOCKSCOUT_PREFIX}", blockscoutPrefix);
}

const sourcifyChains: SourcifyChainsObject = {
  "1": {
    // Ethereum Mainnet
    supported: true,
    monitored: true,
    contractFetchAddress: "https://etherscan.io/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "eth", true),
    txRegex: ETHERSCAN_REGEX,
  },
  "4": {
    // Ethereum Rinkeby Testnet
    supported: true,
    monitored: true,
    contractFetchAddress: "https://rinkeby.etherscan.io/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("rinkeby", "eth", true),
    txRegex: ETHERSCAN_REGEX,
  },
  "5": {
    // Ethereum Goerli Testnet
    supported: true,
    monitored: true,
    contractFetchAddress: "https://goerli.etherscan.io/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "eth", true),
    txRegex: ETHERSCAN_REGEX,
  },
  "11155111": {
    // Ethereum Sepolia Testnet
    supported: true,
    monitored: true,
    rpc: buildAlchemyAndCustomRpcURLs("sepolia", "eth", true).concat(
      "https://rpc.sepolia.org"
    ),
    contractFetchAddress: "https://sepolia.etherscan.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "51": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://apothem.blocksscan.io/" + BLOCKSSCAN_SUFFIX,
  },
  "56": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://bscscan.com/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "77": {
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://blockscout.com/poa/sokol/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/poa/sokol"),
  },
  "82": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://api.meter.io:8000/" + METER_SUFFIX,
  },
  "83": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://api.meter.io:4000/" + METER_SUFFIX,
  },
  "97": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://testnet.bscscan.com/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "100": {
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://blockscout.com/xdai/mainnet/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/xdai/mainnet"),
  },
  "300": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/xdai/optimism/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/xdai/optimism"),
  },
  "137": {
    supported: true,
    monitored: true,
    contractFetchAddress: "https://polygonscan.com/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "polygon"),
    txRegex: ETHERSCAN_REGEX,
  },
  "534": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://candleexplorer.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "42220": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.celo.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "44787": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.celo.org/alfajores/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/alfajores"),
  },
  "62320": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://baklava-blockscout.celo-testnet.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "80001": {
    supported: true,
    monitored: true,
    contractFetchAddress: "https://mumbai.polygonscan.com/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("mumbai", "polygon"),
    txRegex: ETHERSCAN_REGEX,
  },
  "42161": {
    // Arbitrum Mainnet
    supported: true,
    monitored: true,
    contractFetchAddress: "https://arbiscan.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "arb"),
  },
  "421613": {
    // Arbitrum Goerli Testnet
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://goerli-rollup-explorer.arbitrum.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "arb"),
  },
  "43113": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://testnet.snowtrace.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "43114": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://snowtrace.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "57": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.syscoin.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "5700": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://tanenbaum.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "40": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://mainnet.telos.net/" + TELOS_SUFFIX,
  },
  "41": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://testnet.telos.net/" + TELOS_SUFFIX,
  },
  "8": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://ubiqscan.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "311752642": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://mainnet-explorer.oneledger.network/" + BLOCKSCOUT_SUFFIX,
    rpc: ["https://mainnet-rpc.oneledger.network"],
    txRegex: getBlockscoutRegex(),
  },
  "4216137055": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://frankenstein-explorer.oneledger.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "10": {
    supported: true,
    monitored: true,
    contractFetchAddress: "https://optimistic.etherscan.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "opt"),
  },
  "420": {
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://blockscout.com/optimism/goerli/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/optimism/goerli"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "opt"),
  },
  "28": {
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://blockexplorer.rinkeby.boba.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "288": {
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://blockexplorer.boba.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "106": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://evmexplorer.velas.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "1313161554": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.mainnet.aurora.dev/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "1313161555": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.testnet.aurora.dev/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "1284": {
    // Moonbeam
    supported: true,
    monitored: false,
  },
  "1285": {
    // Moonriver
    supported: true,
    monitored: false,
  },
  "1287": {
    // Moonbase
    supported: true,
    monitored: false,
  },
  "11297108109": {
    // Palm
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.palm.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
    rpc: [
      replaceInfuraID("https://palm-mainnet.infura.io/v3/{INFURA_API_KEY}"),
    ],
  },
  "11297108099": {
    // Palm Testnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.palm-uat.xyz/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
    rpc: [
      replaceInfuraID("https://palm-testnet.infura.io/v3/{INFURA_API_KEY}"),
    ],
  },
  "122": {
    // Fuse Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.fuse.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "43": {
    // Darwinia Pangolin Testnet
    supported: true,
    monitored: false,
  },
  "44": {
    // Darwinia Crab Mainnet
    supported: true,
    monitored: false,
  },
  "9000": {
    // Evmos Testnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://evm.evmos.dev/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "9001": {
    // Evmos Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://evm.evmos.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "62621": {
    // MultiVAC Mainnet
    supported: true,
    monitored: false,
  },
  "11111": {
    // WAGMI Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://subnet-explorer-api.avax-test.network/v1.1/11111/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "192837465": {
    // Gather Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.gather.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "486217935": {
    // Gather Devnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://devnet-explorer.gather.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "356256156": {
    // Gather Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://testnet-explorer.gather.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "335": {
    // DFK Chain Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://subnet-explorer-api.avax-test.network/v1.1/335/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "53935": {
    // DFK Chain Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://subnet-explorer-api.avax.network/v1.1/53935/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "73799": {
    // Energy Web Volta Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://volta-explorer.energyweb.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "246": {
    // Energy Web Chain
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.energyweb.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "71401": {
    // Godwoken testnet v1.1
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://gw-testnet-explorer.nervosdao.community/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "71402": {
    // Godwoken mainnet v1.1
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://gw-mainnet-explorer.nervosdao.community/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "432201": {
    // Dexalot Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://subnet-explorer-api.avax-test.network/v1.1/432201/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "103090": {
    // Crystaleum Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://scan.crystaleum.org/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "420666": {
    // Kekchain Testnet (kektest)
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://testnet-explorer.kekchain.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "420420": {
    // Kekchain Main Net (kekistan)
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://mainnet-explorer.kekchain.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "7700": {
    // Canto Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://evm.explorer.canto.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "99": {
    // POA Network Core
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/poa/core/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/poa/core"),
    rpc: ["https://core.poa.network"],
  },
  "592": {
    // Astar (EVM)
    supported: true,
    monitored: false,
    contractFetchAddress: "https://blockscout.com/astar/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/astar"),
  },
  "10200": {
    // Gnosis Chiado Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.chiadochain.net/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "1001": {
    // Klaytn Testnet Baobab
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://klaytn-testnet.blockscout.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "8217": {
    // Klaytn Mainnet Cypress
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://klaytn-mainnet.blockscout.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "336": {
    // Shiden (EVM)
    supported: true,
    monitored: false,
    contractFetchAddress: "https://blockscout.com/shiden/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/shiden"),
  },
  "28528": {
    // Optimism Bedrock: Goerli Alpha Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/optimism/bedrock-alpha/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/optimism/bedrock-alpha"),
  },
};

export default sourcifyChains;
