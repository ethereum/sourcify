import * as chainsRaw from "./chains.json";
import * as dotenv from "dotenv";
import path from "path";
import { SourcifyEventManager } from "./common/SourcifyEventManager/SourcifyEventManager";
import {
  SourcifyChain,
  SourcifyChainMap,
  SourcifyChainExtension,
  Chain,
} from "@ethereum-sourcify/lib-sourcify";
import { etherscanAPIs } from "./config";
import { ValidationError } from "./common/errors";
import { logger } from "./common/loggerLoki";
import { FetchRequest } from "ethers";

const allChains = chainsRaw as Chain[];

dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", "environments/.env"),
});

const ETHERSCAN_REGEX = ["at txn.*href=.*/tx/(0x.{64})"]; // save as string to be able to return the txRegex in /chains response. If stored as RegExp returns {}
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const ETHERSCAN_API_SUFFIX = `/api?module=contract&action=getcontractcreation&contractaddresses=\${ADDRESS}&apikey=`;
const BLOCKSSCAN_SUFFIX = "api/accounts/${ADDRESS}";
const BLOCKSCOUT_REGEX_OLD =
  'transaction_hash_link" href="${BLOCKSCOUT_PREFIX}/tx/(.*?)"';
const BLOCKSCOUT_REGEX_NEW = "at txn.*href.*/tx/(0x.{64}?)";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";
const TELOS_SUFFIX = "v2/evm/get_contract?contract=${ADDRESS}";
const METER_SUFFIX = "api/accounts/${ADDRESS}";
const AVALANCHE_SUBNET_SUFFIX =
  "contracts/${ADDRESS}/transactions:getDeployment";

type ChainName = "eth" | "polygon" | "arb" | "opt";

const LOCAL_CHAINS: SourcifyChain[] = [
  new SourcifyChain({
    name: "Ganache Localhost",
    shortName: "Ganache",
    chainId: 1337,
    faucets: [],
    infoURL: "localhost",
    nativeCurrency: { name: "localETH", symbol: "localETH", decimals: 18 },
    network: "testnet",
    networkId: 1337,
    rpc: [`http://localhost:8545`],
    supported: true,
    monitored: true,
  }),
  new SourcifyChain({
    name: "Hardhat Network Localhost",
    shortName: "Hardhat Network",
    chainId: 31337,
    faucets: [],
    infoURL: "localhost",
    nativeCurrency: { name: "localETH", symbol: "localETH", decimals: 18 },
    network: "testnet",
    networkId: 31337,
    rpc: [`http://localhost:8545`],
    supported: true,
    monitored: true,
  }),
];

interface SourcifyChainsExtensionsObject {
  [chainId: string]: SourcifyChainExtension;
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
  const rpcURLs: SourcifyChain["rpc"] = [];

  if (useOwn) {
    const url = process.env[`NODE_URL_${chainSubName.toUpperCase()}`];
    if (url) {
      const ethersFetchReq = new FetchRequest(url);
      ethersFetchReq.setHeader("Content-Type", "application/json");
      ethersFetchReq.setHeader(
        "CF-Access-Client-Id",
        process.env.CF_ACCESS_CLIENT_ID || ""
      );
      ethersFetchReq.setHeader(
        "CF-Access-Client-Secret",
        process.env.CF_ACCESS_CLIENT_SECRET || ""
      );
      rpcURLs.push(ethersFetchReq);
    } else {
      SourcifyEventManager.trigger("Server.SourcifyChains.Warn", {
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

  if (!alchemyId) {
    SourcifyEventManager.trigger("Server.SourcifyChains.Warn", {
      message: `Environment variable ALCHEMY_ID not set for ${chainName} ${chainSubName}!`,
    });
  } else {
    const domain = "g.alchemy.com";
    rpcURLs.push(
      `https://${chainName}-${chainSubName}.${domain}/v2/${alchemyId}`
    );
  }

  return rpcURLs;
}
// replaces INFURA_API_KEY in https://networkname.infura.io/v3/{INFURA_API_KEY}
function replaceInfuraID(infuraURL: string) {
  return infuraURL.replace("{INFURA_API_KEY}", process.env.INFURA_ID || "");
}
function getBlockscoutRegex(blockscoutPrefix = "") {
  const tempBlockscoutOld = BLOCKSCOUT_REGEX_OLD.replace(
    "${BLOCKSCOUT_PREFIX}",
    blockscoutPrefix
  );
  return [tempBlockscoutOld, BLOCKSCOUT_REGEX_NEW];
}

// api?module=contract&action=getcontractcreation&contractaddresses=\${ADDRESS}&apikey=
// For chains with the new Etherscan api that has contract creator tx hash endpoint
function generateEtherscanCreatorTxAPI(chainId: string) {
  return (
    etherscanAPIs[chainId].apiURL +
    ETHERSCAN_API_SUFFIX +
    etherscanAPIs[chainId].apiKey
  );
}

const sourcifyChainsExtensions: SourcifyChainsExtensionsObject = {
  "1": {
    // Ethereum Mainnet
    supported: true,
    monitored: true,
    contractFetchAddress: generateEtherscanCreatorTxAPI("1"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "eth", true),
  },
  "5": {
    // Ethereum Goerli Testnet
    supported: true,
    monitored: true,
    contractFetchAddress: generateEtherscanCreatorTxAPI("5"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "eth", true),
  },
  "11155111": {
    // Ethereum Sepolia Testnet
    supported: true,
    monitored: true,
    rpc: buildAlchemyAndCustomRpcURLs("sepolia", "eth", true),
    contractFetchAddress: generateEtherscanCreatorTxAPI("11155111"),
  },
  "3": {
    // Deprecated
    // Ethereum Ropsten Testnet
    supported: false,
    monitored: false,
    contractFetchAddress: "https://ropsten.etherscan.io/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("ropsten", "eth"),
    txRegex: ETHERSCAN_REGEX,
  },
  "4": {
    // Deprecated
    // Ethereum Rinkeby Testnet
    supported: false,
    monitored: false,
    contractFetchAddress: "https://rinkeby.etherscan.io/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("rinkeby", "eth", true),
    txRegex: ETHERSCAN_REGEX,
  },
  "42": {
    // Deprecated
    // Ethereum Kovan Testnet
    supported: false,
    monitored: false,
    contractFetchAddress: "https://kovan.etherscan.io/" + ETHERSCAN_SUFFIX,
    rpc: buildAlchemyAndCustomRpcURLs("kovan", "eth"),
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
    contractFetchAddress: generateEtherscanCreatorTxAPI("56"),
  },
  "61": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/etc/mainnet/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/etc/mainnet"),
  },
  "77": {
    // Turned off as seemingly stale
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/poa/sokol/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/poa/sokol"),
  },
  "82": {
    // Meter Mainnet
    supported: true,
    monitored: true,
    contractFetchAddress: "https://api.meter.io:8000/" + METER_SUFFIX,
  },
  "83": {
    // Meter Testnet
    supported: true,
    monitored: true,
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
  "295": {
    // Hedera Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://hashscan.io/mainnet/" + ETHERSCAN_SUFFIX,
  },
  "300": {
    // Turned off as seems to be shut down
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/xdai/optimism/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/xdai/optimism"),
  },
  "314": {
    supported: true,
    monitored: false,
  },
  "137": {
    supported: true,
    monitored: true,
    contractFetchAddress: generateEtherscanCreatorTxAPI("137"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "polygon"),
  },
  "534": {
    // Turned off as seems to be stale
    supported: false,
    monitored: false,
    contractFetchAddress: "https://candleexplorer.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "42220": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.celo.org/mainnet/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/mainnet"),
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
    // Arbitrum One Mainnet
    supported: true,
    monitored: true,
    contractFetchAddress: generateEtherscanCreatorTxAPI("42161"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "arb"),
  },
  "421613": {
    // Arbitrum Goerli Testnet
    supported: true,
    monitored: true,
    contractFetchAddress: generateEtherscanCreatorTxAPI("421613"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "arb"),
  },
  "43113": {
    // Avalanche Fuji Testnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://testnet.snowtrace.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "43114": {
    // Avalanche C-Chain Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: generateEtherscanCreatorTxAPI("43114"),
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
  "570": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.rollux.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "57000": {
    supported: true,
    monitored: false,
    contractFetchAddress: "https://rollux.tanenbaum.io/" + BLOCKSCOUT_SUFFIX,
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
    // Turned off due to inactivity
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://frankenstein-explorer.oneledger.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "10": {
    // Optimism Mainnet
    supported: true,
    monitored: true,
    contractFetchAddress: generateEtherscanCreatorTxAPI("10"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "opt"),
  },
  "420": {
    // Optimism Goerli
    supported: true,
    monitored: true,
    contractFetchAddress:
      "https://blockscout.com/optimism/goerli/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/optimism/goerli"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "opt"),
  },
  "28": {
    // Turned off support as the chains seems shut down
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://blockexplorer.rinkeby.boba.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "288": {
    supported: true,
    monitored: false,
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
    contractFetchAddress: generateEtherscanCreatorTxAPI("1284"),
  },
  "1285": {
    // Moonriver
    supported: true,
    monitored: false,
    contractFetchAddress: generateEtherscanCreatorTxAPI("1285"),
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
    // Turned off support
    // Darwinia Pangolin Testnet
    supported: false,
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
      `https://glacier-api.avax.network/v1/chains/11111/` +
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
    // Turn off support as the chain seems to be shut down
    // Gather Devnet
    supported: false,
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
      `https://glacier-api.avax.network/v1/chains/335/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "53935": {
    // DFK Chain Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://glacier-api.avax.network/v1/chains/53935/` +
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
      `https://glacier-api.avax.network/v1/chains/432201/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "432204": {
    // Dexalot Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://glacier-api.avax.network/v1/chains/432204/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "103090": {
    // Turn off support as the chain seems to be shut down
    // Crystaleum Mainnet
    supported: false,
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
    contractFetchAddress: "https://tuber.build/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "7701": {
    // Canto Testnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://testnet.tuber.build/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "99": {
    // Turned off support as the chain seems to be shut down
    // POA Network Core
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/poa/core/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/poa/core"),
    rpc: ["https://core.poa.network"],
  },
  "592": {
    // Turned off support as RPCs are failing
    // Astar (EVM)
    supported: false,
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
    // Turned off support as the chain seems to be shut down
    // Optimism Bedrock: Goerli Alpha Testnet
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.com/optimism/bedrock-alpha/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex("/optimism/bedrock-alpha"),
  },
  "7001": {
    // ZetaChain: Athens Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.athens2.zetachain.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "42262": {
    // Oasis Emerald Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.emerald.oasis.dev/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "42261": {
    // Oasis Emerald Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://testnet.explorer.emerald.oasis.dev/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "23294": {
    // Oasis Sapphire Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.sapphire.oasis.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "23295": {
    // Oasis Sapphire Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://testnet.explorer.sapphire.oasis.dev/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "19": {
    // Songbird Canary Network
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://songbird-explorer.flare.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "14": {
    // Turned off support as RPCs are failing
    // Flare Mainnet
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://flare-explorer.flare.network/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "2047": {
    // Turned off support as RPCs are failing
    // Stratos Testnet
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://web3-testnet-explorer.thestratos.org/" + BLOCKSCOUT_SUFFIX,
    rpc: ["https://web3-testnet-rpc.thestratos.org"],
    txRegex: getBlockscoutRegex(),
  },
  "641230": {
    // Bear Network Chain Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://brnkscan.bearnetwork.net/" + BLOCKSCOUT_SUFFIX,
    rpc: ["https://brnkc-mainnet.bearnetwork.net"],
    txRegex: getBlockscoutRegex(),
  },
  "84531": {
    // Base Goerli Testnet
    supported: true,
    monitored: true,
    contractFetchAddress: "https://goerli.basescan.org/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "888": {
    // Wanchain Mainnet
    supported: true,
    monitored: false,
    txRegex: ETHERSCAN_REGEX,
  },
  "999": {
    // Wanchain Testnet
    supported: true,
    monitored: false,
    txRegex: ETHERSCAN_REGEX,
  },
  "7668": {
    // The Root Network Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.rootnet.live/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "7672": {
    // The Root Network Porcini (Testnet)
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.rootnet.cloud/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "421611": {
    // Arbitrum Rinkeby Testnet
    supported: false,
    monitored: false,
    graphQLFetchAddress: "https://rinkeby-indexer.arbitrum.io/graphql",
    rpc: buildAlchemyAndCustomRpcURLs("rinkeby", "arb"),
  },
  "69": {
    supported: false,
    monitored: false,
    contractFetchAddress:
      "https://kovan-optimistic.etherscan.io/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
    rpc: buildAlchemyAndCustomRpcURLs("kovan", "opt"),
  },
  "1149": {
    // Symplexia Smart Chain
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.plexfinance.us/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "2000": {
    // DogeChain Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.dogechain.dog/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "25925": {
    // Bitkub Chain Testnet
    supported: true,
    monitored: false,
    contractFetchAddress: "https://testnet.bkcscan.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "96": {
    // Bitkub Chain
    supported: true,
    monitored: false,
    contractFetchAddress: "https://bkcscan.com/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "25": {
    // Cronos Mainnet Beta
    supported: true,
    monitored: false,
    contractFetchAddress: "https://cronoscan.com/" + ETHERSCAN_SUFFIX,
    txRegex: ETHERSCAN_REGEX,
  },
  "1339": {
    // Elysium Mainnet Chain
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://blockscout.elysiumchain.tech/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "167005": {
    // Taiko Alpha-3
    supported: true,
    monitored: false,
  },
  "7777777": {
    // ZORA
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.zora.co/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "6119": {
    // UPTN Mainnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      `https://glacier-api.avax.network/v1/chains/6119/` +
      AVALANCHE_SUBNET_SUFFIX,
  },
  "2222": {
    // Kava EVM
    supported: true,
    monitored: false,
    contractFetchAddress: "https://explorer.kava.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "32769": {
    // Zilliqa EVM
    supported: true,
    monitored: false,
  },
  "33101": {
    // Zilliqa EVM Testnet
    supported: true,
    monitored: false,
  },
  "2221": {
    // Kava EVM Testnet
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://explorer.testnet.kava.io/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
  "111000": {
    supported: true,
    monitored: false,
    contractFetchAddress:
      "https://http://explorer.test.siberium.net/" + BLOCKSCOUT_SUFFIX,
    txRegex: getBlockscoutRegex(),
  },
};

const sourcifyChainsMap: SourcifyChainMap = {};

// Add test chains too if developing or testing
if (process.env.NODE_ENV !== "production") {
  for (const chain of LOCAL_CHAINS) {
    sourcifyChainsMap[chain.chainId.toString()] = chain;
  }
}

// iterate over chainid.network's chains.json file and get the chains included in sourcify.
// Merge the chains.json object with the values from sourcify-chains.ts
// Must iterate over all chains because it's not a mapping but an array.
for (const i in allChains) {
  const chain = allChains[i];
  const chainId = chain.chainId;
  if (chainId in sourcifyChainsMap) {
    // Don't throw on local chains in development, override the chain.json item
    if (
      process.env.NODE_ENV !== "production" &&
      LOCAL_CHAINS.map((c) => c.chainId).includes(chainId)
    ) {
      continue;
    }
    const err = `Corrupt chains file (chains.json): multiple chains have the same chainId: ${chainId}`;
    throw new Error(err);
  }

  if (chainId in sourcifyChainsExtensions) {
    const sourcifyExtension = sourcifyChainsExtensions[chainId];
    // sourcifyExtension is spread later to overwrite chain values, rpc specifically
    const sourcifyChain = new SourcifyChain({
      ...chain,
      ...sourcifyExtension,
    });
    sourcifyChainsMap[chainId] = sourcifyChain;
  }
}

const sourcifyChainsArray = getSortedChainsArray(sourcifyChainsMap);
const supportedChainsArray = sourcifyChainsArray.filter(
  (chain) => chain.supported
);
// convert supportedChainArray to a map where the key is the chainId
const supportedChainsMap = supportedChainsArray.reduce(
  (map, chain) => ((map[chain.chainId.toString()] = chain), map),
  <SourcifyChainMap>{}
);
const monitoredChainArray = sourcifyChainsArray.filter(
  (chain) => chain.monitored
);
// convert monitoredChainArray to a map where the key is the chainId
const monitoredChainsMap = monitoredChainArray.reduce(
  (map, chain) => ((map[chain.chainId.toString()] = chain), map),
  <SourcifyChainMap>{}
);

// Gets the chainsMap, sorts the chains, returns Chain array.
export function getSortedChainsArray(
  chainMap: SourcifyChainMap
): SourcifyChain[] {
  function getPrimarySortKey(chain: any) {
    return chain.name || chain.title;
  }

  const chainsArray = Object.values(chainMap);
  // Have Ethereum chains on top.
  const ethereumChainIds = [1, 5, 11155111, 3, 4, 42];
  const ethereumChains = ethereumChainIds.map((id) => {
    // Use long form name for Ethereum netorks e.g. "Ethereum Testnet Goerli" instead of "Goerli"
    chainMap[id].name = chainMap[id].title || chainMap[id].name;
    return chainMap[id];
  });
  // Others, sorted alphabetically
  const otherChains = chainsArray
    .filter((chain) => ![1, 5, 11155111, 3, 4, 42].includes(chain.chainId))
    .sort((a, b) =>
      getPrimarySortKey(a) > getPrimarySortKey(b)
        ? 1
        : getPrimarySortKey(b) > getPrimarySortKey(a)
        ? -1
        : 0
    );

  const sortedChains = ethereumChains.concat(otherChains);
  return sortedChains;
}

/**
 * To check if a chain is supported for verification.
 * Note that there might be chains not supported for verification anymore but still exist as a SourcifyChain e.g. Ropsten.
 */
export function checkSupportedChainId(chainId: string) {
  if (!(chainId in sourcifyChainsMap && sourcifyChainsMap[chainId].supported)) {
    throw new ValidationError(
      `Chain ${chainId} not supported for verification!`
    );
  }

  return true;
}

/**
 * To check if a chain exists as a SourcifyChain.
 * Note that there might be chains not supported for verification anymore but still exist as a SourcifyChain e.g. Ropsten.
 */
export function checkSourcifyChainId(chainId: string) {
  if (
    !(chainId in sourcifyChainsMap && sourcifyChainsMap[chainId]) &&
    chainId != "0"
  ) {
    throw new Error(`Chain ${chainId} is not a Sourcify chain!`);
  }

  return true;
}

export {
  sourcifyChainsMap,
  sourcifyChainsArray,
  supportedChainsMap,
  supportedChainsArray,
  monitoredChainsMap,
  monitoredChainArray,
  LOCAL_CHAINS,
};
