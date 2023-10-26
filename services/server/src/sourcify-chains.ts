import * as chainsRaw from "./chains.json";
import * as dotenv from "dotenv";
import path from "path";
import { SourcifyEventManager } from "./common/SourcifyEventManager/SourcifyEventManager";
import {
  SourcifyChain,
  SourcifyChainMap,
  SourcifyChainExtension,
  Chain,
  ContractCreationFetcher,
} from "@ethereum-sourcify/lib-sourcify";
import {
  etherscanAPIs,
  blockscoutAPIs,
  blockscanAPIs,
  meterAPIs,
  telosAPIs,
} from "./config";
import { ValidationError } from "./common/errors";
import { FetchRequest } from "ethers";

const allChains = chainsRaw as Chain[];

dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", ".env"),
});

const ETHERSCAN_API_SUFFIX = `/api?module=contract&action=getcontractcreation&contractaddresses=\${ADDRESS}&apikey=`;
const BLOCKSSCAN_SUFFIX = "api/accounts/${ADDRESS}";
const BLOCKSCOUT_API_SUFFIX = "/api/v2/addresses/${ADDRESS}";
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
        process.env["ALCHEMY_API_KEY_OPTIMISM"] ||
        process.env["ALCHEMY_API_KEY"];
      break;
    case "arb":
      alchemyId =
        process.env["ALCHEMY_API_KEY_ARBITRUM"] ||
        process.env["ALCHEMY_API_KEY"];
      break;
    default:
      alchemyId = process.env["ALCHEMY_API_KEY"];
      break;
  }

  if (!alchemyId) {
    SourcifyEventManager.trigger("Server.SourcifyChains.Warn", {
      message: `Environment variable ALCHEMY_API_KEY not set for ${chainName} ${chainSubName}!`,
    });
  } else {
    const domain = "g.alchemy.com";
    rpcURLs.push(
      `https://${chainName}-${chainSubName}.${domain}/v2/${alchemyId}`
    );
  }

  return rpcURLs.length ? rpcURLs : undefined;
}
// replaces INFURA_API_KEY in https://networkname.infura.io/v3/{INFURA_API_KEY}
function replaceInfuraApiKey(infuraURL: string) {
  return infuraURL.replace(
    "{INFURA_API_KEY}",
    process.env.INFURA_API_KEY || ""
  );
}

function getContractCreationFetcher(
  url: string,
  responseParser: Function
): ContractCreationFetcher {
  return {
    url,
    responseParser,
  };
}

// api?module=contract&action=getcontractcreation&contractaddresses=\${ADDRESS}&apikey=
// For chains with the new Etherscan api that has contract creator tx hash endpoint
function getEtherscanContractCreatorFetcher(
  chainId: string
): ContractCreationFetcher | undefined {
  return getContractCreationFetcher(
    etherscanAPIs[chainId].apiURL +
      ETHERSCAN_API_SUFFIX +
      etherscanAPIs[chainId].apiKey,
    (response: any) => {
      if (response?.result?.[0]?.txHash)
        return response?.result?.[0]?.txHash as string;
    }
  );
}

function getBlockscoutContractCreatorFetcher(
  chainId: string
): ContractCreationFetcher | undefined {
  if (blockscoutAPIs[chainId].supported) {
    return getContractCreationFetcher(
      blockscoutAPIs[chainId].apiURL + BLOCKSCOUT_API_SUFFIX,
      (response: any) => response?.creation_tx_hash
    );
  }
  return undefined;
}

function getBlockscanContractCreatorFetcher(
  chainId: string
): ContractCreationFetcher | undefined {
  if (blockscanAPIs[chainId]) {
    return getContractCreationFetcher(
      blockscanAPIs[chainId].apiURL + BLOCKSSCAN_SUFFIX,
      (response: any) => {
        if (response.fromTxn) return response.fromTxn as string;
      }
    );
  }
  return undefined;
}

function getMeterContractCreatorFetcher(
  chainId: string
): ContractCreationFetcher | undefined {
  if (meterAPIs[chainId]) {
    return getContractCreationFetcher(
      meterAPIs[chainId].apiURL + METER_SUFFIX,
      (response: any) => {
        return response.account.creationTxHash as string;
      }
    );
  }
  return undefined;
}

function getTelosContractCreatorFetcher(
  chainId: string
): ContractCreationFetcher | undefined {
  if (telosAPIs[chainId]) {
    return getContractCreationFetcher(
      telosAPIs[chainId].apiURL + TELOS_SUFFIX,
      (response: any) => {
        if (response.creation_trx) return response.creation_trx as string;
      }
    );
  }
  return undefined;
}

function getAvalancheContractCreatorFetcher(
  chainId: string
): ContractCreationFetcher | undefined {
  return getContractCreationFetcher(
    `https://glacier-api.avax.network/v1/chains/${chainId}/${AVALANCHE_SUBNET_SUFFIX}`,
    (response: any) => {
      if (response.nativeTransaction?.txHash)
        return response.nativeTransaction.txHash as string;
    }
  );
}

const sourcifyChainsExtensions: SourcifyChainsExtensionsObject = {
  "1": {
    // Ethereum Mainnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("1"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "eth", true),
  },
  "17000": {
    // Ethereum Holesky
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("17000"),
    // Temporary rpc until this is fixed: https://github.com/emeraldpay/dshackle/issues/262
    // rpc: buildAlchemyAndCustomRpcURLs("holesky", "eth", true),
    rpc: ["https://rpc.teku-geth-001.srv.holesky.ethpandaops.io"],
  },
  "5": {
    // Ethereum Goerli Testnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("5"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "eth", true),
  },
  "11155111": {
    // Ethereum Sepolia Testnet
    supported: true,
    rpc: buildAlchemyAndCustomRpcURLs("sepolia", "eth", true),
    contractCreationFetcher: getEtherscanContractCreatorFetcher("11155111"),
  },
  "369": {
    // PulseChain Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("369"),
  },
  "3": {
    // Deprecated
    // Ethereum Ropsten Testnet
    supported: false,
    rpc: buildAlchemyAndCustomRpcURLs("ropsten", "eth"),
  },
  "4": {
    // Deprecated
    // Ethereum Rinkeby Testnet
    supported: false,
    rpc: buildAlchemyAndCustomRpcURLs("rinkeby", "eth", true),
  },
  "42": {
    // Deprecated
    // Ethereum Kovan Testnet
    supported: false,
    rpc: buildAlchemyAndCustomRpcURLs("kovan", "eth"),
  },
  "51": {
    supported: true,
    contractCreationFetcher: getBlockscanContractCreatorFetcher("51"),
  },
  "56": {
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("56"),
  },
  "61": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("61"),
  },
  "77": {
    // Turned off as seemingly stale
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("77"),
  },
  "82": {
    // Meter Mainnet
    supported: true,
    contractCreationFetcher: getMeterContractCreatorFetcher("82"),
  },
  "83": {
    // Meter Testnet
    supported: true,
    contractCreationFetcher: getMeterContractCreatorFetcher("83"),
  },
  "97": {
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("97"),
  },
  "100": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("100"),
  },
  "295": {
    // Hedera Mainnet
    supported: true,
  },
  "300": {
    // Turned off as seems to be shut down
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("300"),
  },
  "314": {
    supported: true,
  },
  "314159": {
    supported: true,
  },
  "137": {
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("137"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "polygon"),
  },
  "534": {
    // Turned off as seems to be stale
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("534"),
  },
  "42220": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("42220"),
  },
  "44787": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("44787"),
  },
  "62320": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("62320"),
  },
  "80001": {
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("80001"),
    rpc: buildAlchemyAndCustomRpcURLs("mumbai", "polygon"),
  },
  "42161": {
    // Arbitrum One Mainnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("42161"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "arb"),
  },
  "421613": {
    // Arbitrum Goerli Testnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("421613"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "arb"),
  },
  "43113": {
    // Avalanche Fuji Testnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("43113"),
  },
  "43114": {
    // Avalanche C-Chain Mainnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("43114"),
  },
  "57": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("57"),
  },
  "5700": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("5700"),
  },
  "570": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("570"),
  },
  "57000": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("57000"),
  },
  "40": {
    supported: true,
    contractCreationFetcher: getTelosContractCreatorFetcher("40"),
  },
  "41": {
    supported: true,
    contractCreationFetcher: getTelosContractCreatorFetcher("41"),
  },
  "8": {
    supported: true,
  },
  "311752642": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("311752642"),
    rpc: ["https://mainnet-rpc.oneledger.network"],
  },
  "4216137055": {
    // Turned off due to inactivity
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("4216137055"),
  },
  "10": {
    // Optimism Mainnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("10"),
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "opt"),
  },
  "420": {
    // Optimism Goerli
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("420"),
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "opt"),
  },
  "28": {
    // Turned off support as the chains seems shut down
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("28"),
  },
  "288": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("288"),
  },
  "106": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("106"),
  },
  "1313161554": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("1313161554"),
  },
  "9996": {
    // Mind Smart Chain Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("9996"),
  },
  "9977": {
    // Mind Smart Chain Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("9977"),
  },
  "1313161555": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("1313161555"),
  },
  "1284": {
    // Moonbeam
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("1284"),
  },
  "1285": {
    // Moonriver
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("1285"),
  },
  "1287": {
    // Moonbase
    supported: true,
  },
  "11297108109": {
    // Palm
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("11297108109"),
    rpc: [
      replaceInfuraApiKey("https://palm-mainnet.infura.io/v3/{INFURA_API_KEY}"),
    ],
  },
  "11297108099": {
    // Palm Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("11297108099"),
    rpc: [
      replaceInfuraApiKey("https://palm-testnet.infura.io/v3/{INFURA_API_KEY}"),
    ],
  },
  "122": {
    // Fuse Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("122"),
  },
  "43": {
    // Turned off support
    // Darwinia Pangolin Testnet
    supported: false,
  },
  "44": {
    // Darwinia Crab Mainnet
    supported: true,
  },
  "9000": {
    // Evmos Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("9000"),
  },
  "9001": {
    // Evmos Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("9001"),
  },
  "62621": {
    // MultiVAC Mainnet
    supported: true,
  },
  "11111": {
    // WAGMI Testnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`11111`),
  },
  "192837465": {
    // Gather Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("192837465"),
  },
  "486217935": {
    // Turn off support as the chain seems to be shut down
    // Gather Devnet
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("486217935"),
  },
  "356256156": {
    // Gather Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("356256156"),
  },
  "335": {
    // DFK Chain Testnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`335`),
  },
  "53935": {
    // DFK Chain Mainnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`53935`),
  },
  "73799": {
    // Energy Web Volta Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("73799"),
  },
  "246": {
    // Energy Web Chain
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("246"),
  },
  "71401": {
    // Godwoken testnet v1.1
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("71401"),
  },
  "71402": {
    // Godwoken mainnet v1.1
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("71402"),
  },
  "432201": {
    // Dexalot Testnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`432201`),
  },
  "432204": {
    // Dexalot Mainnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`432204`),
  },
  "103090": {
    // Turn off support as the chain seems to be shut down
    // Crystaleum Mainnet
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("103090"),
  },
  "420666": {
    // Kekchain Testnet (kektest)
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("420666"),
  },
  "420420": {
    // Kekchain Main Net (kekistan)
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("420420"),
  },
  "7700": {
    // Canto Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("7700"),
  },
  "7701": {
    // Canto Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("7701"),
  },
  "99": {
    // Turned off support as the chain seems to be shut down
    // POA Network Core
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("99"),
    rpc: ["https://core.poa.network"],
  },
  "592": {
    // Turned off support as RPCs are failing
    // Astar (EVM)
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("592"),
  },
  "10200": {
    // Gnosis Chiado Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("10200"),
  },
  "1001": {
    // Klaytn Testnet Baobab
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("1001"),
  },
  "8217": {
    // Klaytn Mainnet Cypress
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("8217"),
  },
  "336": {
    // Shiden (EVM)
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("336"),
  },
  "28528": {
    // Turned off support as the chain seems to be shut down
    // Optimism Bedrock: Goerli Alpha Testnet
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("28528"),
  },
  "7001": {
    // ZetaChain: Athens Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("7001"),
  },
  "42262": {
    // Oasis Emerald Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("42262"),
  },
  "42261": {
    // Oasis Emerald Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("42261"),
  },
  "23294": {
    // Oasis Sapphire Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("23294"),
  },
  "23295": {
    // Oasis Sapphire Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("23295"),
  },
  "19": {
    // Songbird Canary Network
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("19"),
  },
  "14": {
    // Turned off support as RPCs are failing
    // Flare Mainnet
    supported: false,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("14"),
  },
  "2047": {
    // Stratos Testnet (Mesos)
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("2047"),
  },
  "641230": {
    // Bear Network Chain Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("641230"),
    rpc: ["https://brnkc-mainnet.bearnetwork.net"],
  },
  "84531": {
    // Base Goerli Testnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("84531"),
  },
  "8453": {
    // Base Mainnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("8453"),
  },
  "888": {
    // Wanchain Mainnet
    supported: true,
  },
  "999": {
    // Wanchain Testnet
    supported: true,
  },
  "7668": {
    // The Root Network Mainnet
    supported: true,
  },
  "7672": {
    // The Root Network Porcini (Testnet)
    supported: true,
  },
  "421611": {
    // Arbitrum Rinkeby Testnet
    supported: false,
    graphQLFetchAddress: "https://rinkeby-indexer.arbitrum.io/graphql",
    rpc: buildAlchemyAndCustomRpcURLs("rinkeby", "arb"),
  },
  "69": {
    supported: false,
    rpc: buildAlchemyAndCustomRpcURLs("kovan", "opt"),
  },
  "1149": {
    // Symplexia Smart Chain
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("1149"),
  },
  "2000": {
    // DogeChain Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("2000"),
  },
  "25925": {
    // Bitkub Chain Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("25925"),
  },
  "96": {
    // Bitkub Chain
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("96"),
  },
  "25": {
    // Cronos Mainnet Beta
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("25"),
  },
  "1339": {
    // Elysium Mainnet Chain
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("1339"),
  },
  "167005": {
    // Taiko Grimsvotn L2
    supported: true,
  },
  "167006": {
    // Taiko Eldfell L3
    supported: true,
  },
  "7777777": {
    // ZORA
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("7777777"),
  },
  "6119": {
    // UPTN Mainnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`6119`),
  },
  "13337": {
    // BEAM Testnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`13337`),
  },
  "222000222": {
    // Kanazawa Testnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`222000222`),
  },

  "333000333": {
    // MELD
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher(`333000333`),
  },
  "2222": {
    // Kava EVM
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("2222"),
  },
  "32769": {
    // Zilliqa EVM
    supported: true,
  },
  "33101": {
    // Zilliqa EVM Testnet
    supported: true,
  },
  "2221": {
    // Kava EVM Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("2221"),
  },
  "111000": {
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("111000"),
  },
  "212": {
    // MAP Testnet Makalu
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("212"),
  },
  "22776": {
    // map-relay-chain Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("22776"),
  },
  "2021": {
    // Edgeware EdgeEVM Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("2021"),
  },
  "250": {
    // FTM Fantom Opera Mainnet
    supported: true,
  },
  "42170": {
    // Arbitrum Nova
    supported: true,
  },
  "2037": {
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("2037"),
  },
  "4337": {
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("4337"),
  },
  "78432": {
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("78432"),
  },
  "78431": {
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("78431"),
  },
  "78430": {
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("78430"),
  },
  "2038": {
    // Shrapnel Testnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("2038"),
  },
  "2044": {
    // Shrapnel Subnet
    supported: true,
    contractCreationFetcher: getAvalancheContractCreatorFetcher("2044"),
  },
  "10243": {
    // Arthera Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("10243"),
  },
  "1116": {
    // Core Blockchain Mainnet
    supported: true,
    contractCreationFetcher: getEtherscanContractCreatorFetcher("1116"),
  },
  "35441": {
    // Q Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("35441"),
  },
  "35443": {
    // Q Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("35443"),
  },
  "11235": {
    // Haqq Mainnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("11235"),
  },
  "54211": {
    // Haqq Testnet
    supported: true,
    contractCreationFetcher: getBlockscoutContractCreatorFetcher("54211"),
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
      rpc: sourcifyExtension.rpc ? sourcifyExtension.rpc : chain.rpc, // avoid rpc ending up as undefined
    });
    sourcifyChainsMap[chainId] = sourcifyChain;
  }
}

// Check if all chains in sourcify-chains.ts are in chains.json
const missingChains = [];
for (const chainId in sourcifyChainsExtensions) {
  if (!sourcifyChainsMap[chainId]) {
    missingChains.push(chainId);
  }
}
if (missingChains.length > 0) {
  throw new Error(
    `Some of the chains in sourcify-chains.ts are not in chains.json: ${missingChains.join(
      ","
    )}`
  );
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
  LOCAL_CHAINS,
};
