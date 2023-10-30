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
import { ValidationError } from "./common/errors";
import { FetchRequest } from "ethers";

const allChains = chainsRaw as Chain[];

dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", ".env"),
});

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

const sourcifyChainsExtensions: SourcifyChainsExtensionsObject = {
  "1": {
    // Ethereum Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.etherscan.io",
        apiKey: process.env.ETHERSCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "eth", true),
  },
  "17000": {
    // Ethereum Holesky
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-holesky.etherscan.io",
        apiKey: process.env.ETHERSCAN_API_KEY || "",
      },
    },
    // Temporary rpc until this is fixed: https://github.com/emeraldpay/dshackle/issues/262
    // rpc: buildAlchemyAndCustomRpcURLs("holesky", "eth", true),
    rpc: ["https://rpc.teku-geth-001.srv.holesky.ethpandaops.io"],
  },
  "5": {
    // Ethereum Goerli Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-goerli.etherscan.io",
        apiKey: process.env.ETHERSCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "eth", true),
  },
  "11155111": {
    // Ethereum Sepolia Testnet
    supported: true,
    rpc: buildAlchemyAndCustomRpcURLs("sepolia", "eth", true),
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-sepolia.etherscan.io",
        apiKey: process.env.ETHERSCAN_API_KEY || "",
      },
    },
  },
  "369": {
    // PulseChain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://scan.pulsechain.com/",
      },
    },
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
    // Apothem
    supported: true,
    fetchContractCreationTxUsing: {
      blockscanApi: {
        url: "https://apothem.blocksscan.io/",
      },
    },
  },
  "56": {
    // BNB Smart Chain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.bscscan.com/",
        apiKey: process.env.BSCSCAN_API_KEY || "",
      },
    },
  },
  "61": {
    // Ethereum Classic Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://etc.blockscout.com/",
      },
    },
  },
  "77": {
    // Turned off as seemingly stale
    supported: false,
  },
  "82": {
    // Meter Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      meterApi: {
        url: "https://api.meter.io:8000/",
      },
    },
  },
  "83": {
    // Meter Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      meterApi: {
        url: "https://api.meter.io:4000/",
      },
    },
  },
  "97": {
    // BNB Smart Chain Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-testnet.bscscan.com/",
        apiKey: process.env.BSCSCAN_API_KEY || "",
      },
    },
  },
  "100": {
    // Gnosis Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://gnosis.blockscout.com/",
      },
      etherscanApi: {
        url: "https://api.gnosisscan.io",
        apiKey: process.env.GNOSSISCAN_API_KEY || "",
      },
    },
  },
  "295": {
    // Hedera Mainnet
    supported: true,
  },
  "300": {
    // Turned off as seems to be shut down
    supported: false,
  },
  "314": {
    // Filecoin - Mainnet
    supported: true,
  },
  "314159": {
    // Filecoin - Calibration testnet
    supported: true,
  },
  "137": {
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.polygonscan.com",
        apiKey: process.env.POLYGONSCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "polygon"),
  },
  "534": {
    // Turned off as seems to be stale
    supported: false,
  },
  "42220": {
    // Celo Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.celoscan.io",
        apiKey: process.env.CELOSCAN_API_KEY || "",
      },
      blockscoutScrape: {
        url: "https://explorer.celo.org/mainnet/",
      },
    },
  },
  "44787": {
    // Celo Alfajores Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-alfajores.celoscan.io",
        apiKey: process.env.CELOSCAN_API_KEY || "",
      },
      blockscoutScrape: {
        url: "https://explorer.celo.org/alfajores/",
      },
    },
  },
  "62320": {
    // Celo Baklava Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: { url: "https://baklava-blockscout.celo-testnet.org/" },
    },
  },
  "80001": {
    // Polygon Mumbai
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-testnet.polygonscan.com",
        apiKey: process.env.POLYGONSCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("mumbai", "polygon"),
  },
  "42161": {
    // Arbitrum One Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.arbiscan.io",
        apiKey: process.env.ARBISCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "arb"),
  },
  "421613": {
    // Arbitrum Goerli Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-goerli.arbiscan.io",
        apiKey: process.env.ARBISCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "arb"),
  },
  "43113": {
    // Avalanche Fuji Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-testnet.snowtrace.io",
        apiKey: process.env.SNOWTRACE_API_KEY || "",
      },
    },
  },
  "43114": {
    // Avalanche C-Chain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.snowtrace.io",
        apiKey: process.env.SNOWTRACE_API_KEY || "",
      },
    },
  },
  "57": {
    // Syscoin Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.syscoin.org/",
      },
    },
  },
  "5700": {
    // Syscoin Testnet Tanenbaum
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://tanenbaum.io/",
      },
    },
  },
  "570": {
    // Rollux Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer.rollux.com/",
      },
    },
  },
  "57000": {
    // Rollux Testnet Tanenbaum
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://rollux.tanenbaum.io/",
      },
    },
  },
  "40": {
    // Telos Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      telosApi: {
        url: "https://mainnet.telos.net/",
      },
    },
  },
  "41": {
    // Telos Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      telosApi: {
        url: "https://testnet.telos.net/",
      },
    },
  },
  "8": {
    // Ubiq Mainnet
    supported: true,
  },
  "311752642": {
    supported: true,
    rpc: ["https://mainnet-rpc.oneledger.network"],
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://mainnet-explorer.oneledger.network/",
      },
    },
  },
  "4216137055": {
    // Turned off due to inactivity
    supported: false,
  },
  "10": {
    // Optimism Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-optimistic.etherscan.io/",
        apiKey: process.env.OPTIMISMSCAN_API_KEY || "",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("mainnet", "opt"),
  },
  "420": {
    // Optimism Goerli
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-goerli-optimism.etherscan.io",
        apiKey: process.env.OPTIMISMSCAN_API_KEY || "",
      },
      blockscoutApi: {
        url: "https://blockscout.com/optimism/goerli/",
      },
    },
    rpc: buildAlchemyAndCustomRpcURLs("goerli", "opt"),
  },
  "28": {
    // Turned off support as the chains seems shut down
    supported: false,
  },
  "288": {
    // Boba Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://blockexplorer.boba.network/",
      },
    },
  },
  "106": {
    // Velas Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://evmexplorer.velas.com/",
      },
    },
  },
  "1313161554": {
    // Aurora Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer.mainnet.aurora.dev/",
      },
    },
  },
  "9996": {
    // Mind Smart Chain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://mainnet.mindscan.info/",
      },
    },
  },
  "9977": {
    // Mind Smart Chain Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet.mindscan.info/",
      },
    },
  },
  "1313161555": {
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.testnet.aurora.dev/",
      },
    },
  },
  "1284": {
    // Moonbeam
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-moonbeam.moonscan.io",
        apiKey: process.env.MOONSCAN_MOONBEAM_API_KEY || "",
      },
    },
  },
  "1285": {
    // Moonriver
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-moonriver.moonscan.io",
        apiKey: process.env.MOONSCAN_MOONRIVER_API_KEY || "",
      },
    },
  },
  "1287": {
    // Moonbase
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-moonbase.moonscan.io",
        apiKey: "",
      },
    },
  },
  "11297108109": {
    // Palm
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.palm.io/",
      },
    },
    rpc: [
      replaceInfuraApiKey("https://palm-mainnet.infura.io/v3/{INFURA_API_KEY}"),
    ],
  },
  "11297108099": {
    // Palm Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.palm-uat.xyz/",
      },
    },
    rpc: [
      replaceInfuraApiKey("https://palm-testnet.infura.io/v3/{INFURA_API_KEY}"),
    ],
  },
  "122": {
    // Fuse Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer.fuse.io/",
      },
    },
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
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://evm.evmos.dev/",
      },
    },
  },
  "9001": {
    // Evmos Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://evm.evmos.org/",
      },
    },
  },
  "62621": {
    // MultiVAC Mainnet
    supported: true,
  },
  "11111": {
    // WAGMI Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "11111",
      },
    },
  },
  "192837465": {
    // Gather Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.gather.network/",
      },
    },
  },
  "486217935": {
    // Turn off support as the chain seems to be shut down
    // Gather Devnet
    supported: false,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://devnet-explorer.gather.network/",
      },
    },
  },
  "356256156": {
    // Gather Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet-explorer.gather.network/",
      },
    },
  },
  "335": {
    // DFK Chain Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "335",
      },
    },
  },
  "53935": {
    // DFK Chain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "53935",
      },
    },
  },
  "73799": {
    // Energy Web Volta Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://volta-explorer.energyweb.org/",
      },
    },
  },
  "246": {
    // Energy Web Chain
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.energyweb.org/",
      },
    },
  },
  "71401": {
    // Godwoken testnet v1.1
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://gw-testnet-explorer.nervosdao.community/",
      },
    },
  },
  "71402": {
    // Godwoken mainnet v1.1
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://gw-mainnet-explorer.nervosdao.community/",
      },
    },
  },
  "432201": {
    // Dexalot Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: `432201`,
      },
    },
  },
  "432204": {
    // Dexalot Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "432204",
      },
    },
  },
  "103090": {
    // Turn off support as the chain seems to be shut down
    // Crystaleum Mainnet
    supported: false,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://scan.crystaleum.org/",
      },
    },
  },
  "420666": {
    // Kekchain Testnet (kektest)
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet-explorer.kekchain.com/",
      },
    },
  },
  "420420": {
    // Kekchain Main Net (kekistan)
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://mainnet-explorer.kekchain.com/",
      },
    },
  },
  "7700": {
    // Canto Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://tuber.build/",
      },
    },
  },
  "7701": {
    // Canto Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://testnet.tuber.build/",
      },
    },
  },
  "99": {
    // Turned off support as the chain seems to be shut down
    // POA Network Core
    supported: false,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://blockscout.com/poa/core/",
      },
    },
    rpc: ["https://core.poa.network"],
  },
  "592": {
    // Turned off support as RPCs are failing
    // Astar (EVM)
    supported: false,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://blockscout.com/astar/",
      },
    },
  },
  "10200": {
    // Gnosis Chiado Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://blockscout.chiadochain.net/",
      },
    },
  },
  "1001": {
    // Klaytn Testnet Baobab
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://klaytn-testnet.blockscout.com/",
      },
    },
  },
  "8217": {
    // Klaytn Mainnet Cypress
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://klaytn-mainnet.blockscout.com/",
      },
    },
  },
  "336": {
    // Shiden (EVM)
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://blockscout.com/shiden/",
      },
    },
  },
  "28528": {
    // Turned off support as the chain seems to be shut down
    // Optimism Bedrock: Goerli Alpha Testnet
    supported: false,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://blockscout.com/optimism/bedrock-alpha/",
      },
    },
  },
  "7001": {
    // ZetaChain: Athens Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://blockscout.athens2.zetachain.com/",
      },
    },
  },
  "42262": {
    // Oasis Emerald Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.emerald.oasis.dev/",
      },
    },
  },
  "42261": {
    // Oasis Emerald Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet.explorer.emerald.oasis.dev/",
      },
    },
  },
  "23294": {
    // Oasis Sapphire Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.sapphire.oasis.io/",
      },
    },
  },
  "23295": {
    // Oasis Sapphire Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet.explorer.sapphire.oasis.dev/",
      },
    },
  },
  "19": {
    // Songbird Canary Network
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://songbird-explorer.flare.network/",
      },
    },
  },
  "14": {
    // Turned off support as RPCs are failing
    // Flare Mainnet
    supported: false,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://flare-explorer.flare.network/",
      },
    },
  },
  "2047": {
    // Stratos Testnet (Mesos)
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://web3-explorer-mesos.thestratos.org/",
      },
    },
  },
  "641230": {
    // Bear Network Chain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://brnkscan.bearnetwork.net/",
      },
    },
    rpc: ["https://brnkc-mainnet.bearnetwork.net"],
  },
  "84531": {
    // Base Goerli Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api-goerli.basescan.org/",
        apiKey: "",
      },
    },
  },
  "8453": {
    // Base Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.basescan.org/",
        apiKey: process.env.BASESCAN_API_KEY || "",
      },
    },
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
    rpc: buildAlchemyAndCustomRpcURLs("rinkeby", "arb"),
  },
  "69": {
    supported: false,
    rpc: buildAlchemyAndCustomRpcURLs("kovan", "opt"),
  },
  "1149": {
    // Symplexia Smart Chain
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.plexfinance.us/",
      },
    },
  },
  "2000": {
    // DogeChain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.dogechain.dog/",
      },
    },
  },
  "25925": {
    // Bitkub Chain Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet.bkcscan.com/",
      },
    },
  },
  "96": {
    // Bitkub Chain
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://bkcscan.com/",
      },
    },
  },
  "25": {
    // Cronos Mainnet Beta
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://api.cronoscan.com/",
        apiKey: process.env.CRONOSCAN_API_KEY || "",
      },
    },
  },
  "1339": {
    // Elysium Mainnet Chain
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://blockscout.elysiumchain.tech/",
      },
    },
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
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer.zora.co/",
      },
    },
  },
  "6119": {
    // UPTN Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "6119",
      },
    },
  },
  "13337": {
    // BEAM Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "13337",
      },
    },
  },
  "222000222": {
    // Kanazawa Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "222000222",
      },
    },
  },

  "333000333": {
    // MELD
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "333000333",
      },
    },
  },
  "2222": {
    // Kava EVM
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.kava.io/",
      },
    },
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
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.testnet.kava.io/",
      },
    },
  },
  "111000": {
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://http://explorer.test.siberium.net/",
      },
    },
  },
  "212": {
    // MAP Testnet Makalu
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://testnet.maposcan.io/",
      },
    },
  },
  "22776": {
    // map-relay-chain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://maposcan.io/",
      },
    },
  },
  "2021": {
    // Edgeware EdgeEVM Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://edgscan.live/",
      },
    },
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
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "2037",
      },
    },
  },
  "4337": {
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "4337",
      },
    },
  },
  "78432": {
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "78432",
      },
    },
  },
  "78431": {
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "78431",
      },
    },
  },
  "78430": {
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "78430",
      },
    },
  },
  "2038": {
    // Shrapnel Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "2038",
      },
    },
  },
  "2044": {
    // Shrapnel Subnet
    supported: true,
    fetchContractCreationTxUsing: {
      avalancheApi: {
        chainId: "2044",
      },
    },
  },
  "10243": {
    // Arthera Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer-test.arthera.net/",
      },
    },
  },
  "1116": {
    // Core Blockchain Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      etherscanApi: {
        url: "https://openapi.coredao.org/",
        apiKey: process.env.COREDAO_API_KEY || "",
      },
    },
  },
  "35441": {
    // Q Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.q.org/",
      },
    },
  },
  "35443": {
    // Q Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutScrape: {
        url: "https://explorer.qtestnet.org/",
      },
    },
  },
  "11235": {
    // Haqq Mainnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer.haqq.network/",
      },
    },
  },
  "54211": {
    // Haqq Testnet
    supported: true,
    fetchContractCreationTxUsing: {
      blockscoutApi: {
        url: "https://explorer.testedge2.haqq.network/",
      },
    },
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
