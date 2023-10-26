/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
import path from "path";
import { SourcifyEventManager } from "./common/SourcifyEventManager/SourcifyEventManager";
import { logger } from "./common/loggerLoki";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const setRepositoryPath = () => {
  if (process.env.MOCK_REPOSITORY) return process.env.MOCK_REPOSITORY;
  if (process.env.REPOSITORY_PATH)
    return path.resolve(__dirname, process.env.REPOSITORY_PATH);
  logger.warn("REPOSITORY_PATH not set. Using default /tmp/repository.");
  return "/tmp/repository";
};

// TODO: Don't use config.ts at all. Since as a module config is evaluated only once, this can cause changed environment variables not to take effect. E.g. if you run a Monitor and a Server with different REPOSITORY_PATHs, the server will have monitor's repo path since this was already evaluated and won't be run again. Instead these should be put in place in constructors etc.
export default {
  monitor: {
    port: process.env.MONITOR_PORT || 80,
  },
  server: {
    port: process.env.SERVER_PORT || 5000,
    maxFileSize: 30 * 1024 * 1024, // 30 MB
  },
  repository: {
    path: setRepositoryPath(),
  },
  testing: process.env.TESTING || false,
  tag: process.env.TAG || "latest",
  logging: {
    dir: process.env.LOGGING_DIR || "logs",
    level: process.env.LOGGING_LEVEL || "debug",
  },
  session: {
    secret: process.env.SESSION_SECRET || "session top secret",
    maxAge:
      (process.env.SESSION_MAX_AGE && parseInt(process.env.SESSION_MAX_AGE)) ||
      12 * 60 * 60 * 1000, // 12 hrs in millis
    secure:
      process.env.NODE_ENV === "production" && process.env.TESTING !== "true", // Set Secure in the Set-Cookie header i.e. require https
  },
  corsAllowedOrigins: [
    /^https?:\/\/(?:.+\.)?sourcify.dev$/, // sourcify.dev and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth$/, // sourcify.eth and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth.link$/, // sourcify.eth.link and subdomains
    /^https?:\/\/(?:.+\.)?ipfs.dweb.link$/, // dweb links used by Brave browser etc.
    process.env.NODE_ENV === "development" && /^https?:\/\/localhost(?::\d+)?$/, // localhost on any port
  ],
};

type EtherscanAPIs = {
  [key: string]: {
    apiURL: string;
    apiKey: string | undefined;
  };
};

export const etherscanAPIs: EtherscanAPIs = {
  "1": {
    apiURL: "https://api.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  "17000": {
    apiURL: "https://api-holesky.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  "5": {
    apiURL: "https://api-goerli.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  "11155111": {
    apiURL: "https://api-sepolia.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  "42161": {
    apiURL: "https://api.arbiscan.io",
    apiKey: process.env.ARBISCAN_API_KEY,
  },
  "421613": {
    apiURL: "https://api-goerli.arbiscan.io",
    apiKey: process.env.ARBISCAN_API_KEY,
  },
  "10": {
    apiURL: "https://api-optimistic.etherscan.io",
    apiKey: process.env.OPTIMISMSCAN_API_KEY,
  },
  "420": {
    apiURL: "https://api-goerli-optimism.etherscan.io",
    apiKey: process.env.OPTIMISMSCAN_API_KEY,
  },
  "43114": {
    apiURL: "https://api.snowtrace.io",
    apiKey: process.env.SNOWTRACE_API_KEY,
  },
  "43113": {
    apiURL: "https://api-testnet.snowtrace.io",
    apiKey: process.env.SNOWTRACE_API_KEY,
  },
  "56": {
    apiURL: "https://api.bscscan.com",
    apiKey: process.env.BSCSCAN_API_KEY,
  },
  "97": {
    apiURL: "https://api-testnet.bscscan.com",
    apiKey: process.env.BSCSCAN_API_KEY,
  },
  "137": {
    apiURL: "https://api.polygonscan.com",
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  "80001": {
    apiURL: "https://api-testnet.polygonscan.com",
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  "42220": {
    apiURL: "https://api.celoscan.io",
    apiKey: process.env.CELOSCAN_API_KEY,
  },
  "44787": {
    apiURL: "https://api-alfajores.celoscan.io",
    apiKey: process.env.CELOSCAN_API_KEY,
  },
  "1284": {
    apiURL: "https://api-moonbeam.moonscan.io",
    apiKey: process.env.MOONSCAN_MOONBEAM_API_KEY,
  },
  "1285": {
    apiURL: "https://api-moonriver.moonscan.io",
    apiKey: process.env.MOONSCAN_MOONRIVER_API_KEY,
  },
  // Does not require API key
  "1287": {
    apiURL: "https://api-moonbase.moonscan.io",
    apiKey: "",
  },
  "100": {
    apiURL: "https://api.gnosisscan.io",
    apiKey: process.env.GNOSSISCAN_API_KEY,
  },
  "25": {
    apiURL: "https://api.cronoscan.com/",
    apiKey: process.env.CRONOSCAN_API_KEY,
  },
  // Does not require API key
  "84531": {
    apiURL: "https://api-goerli.basescan.org/",
    apiKey: "",
  },
  "8453": {
    apiURL: "https://api.basescan.org/",
    apiKey: process.env.BASESCAN_API_KEY,
  },
  "1116": {
    apiURL: "https://openapi.coredao.org/",
    apiKey: process.env.COREDAO_API_KEY,
  },
};

type BlockscoutAPIs = {
  [key: string]: {
    apiURL: string;
    supported: boolean;
  };
};

export const blockscoutAPIs: BlockscoutAPIs = {
  "77": {
    apiURL: "https://blockscout.com/poa/sokol/",
    supported: true,
  },
  "100": {
    apiURL: "https://blockscout.com/xdai/mainnet/",
    supported: true,
  },
  "300": {
    apiURL: "https://blockscout.com/xdai/optimism/",
    supported: false,
  },
  "534": {
    apiURL: "https://candleexplorer.com/",
    supported: false,
  },
  "42220": {
    apiURL: "https://explorer.celo.org/mainnet/",
    supported: false,
  },
  "44787": {
    apiURL: "https://explorer.celo.org/alfajores/",
    supported: false,
  },
  "62320": {
    apiURL: "https://baklava-blockscout.celo-testnet.org/",
    supported: false,
  },
  "57": {
    apiURL: "https://explorer.syscoin.org/",
    supported: false,
  },
  "5700": {
    apiURL: "https://tanenbaum.io/",
    supported: false,
  },
  "570": {
    apiURL: "https://explorer.rollux.com/",
    supported: true,
  },
  "57000": {
    apiURL: "https://rollux.tanenbaum.io/",
    supported: true,
  },
  "311752642": {
    apiURL: "https://mainnet-explorer.oneledger.network/",
    supported: false,
  },
  "4216137055": {
    apiURL: "https://frankenstein-explorer.oneledger.network/",
    supported: false,
  },
  "420": {
    apiURL: "https://blockscout.com/optimism/goerli/",
    supported: true,
  },
  "28": {
    apiURL: "https://blockexplorer.rinkeby.boba.network/",
    supported: false,
  },
  "288": {
    apiURL: "https://blockexplorer.boba.network/",
    supported: false,
  },
  "106": {
    apiURL: "https://evmexplorer.velas.com/",
    supported: false,
  },
  "1313161554": {
    apiURL: "https://explorer.mainnet.aurora.dev/",
    supported: true,
  },
  "9996": {
    apiURL: "https://mainnet.mindscan.info/",
    supported: false,
  },
  "9977": {
    apiURL: "https://testnet.mindscan.info/",
    supported: false,
  },
  "1313161555": {
    apiURL: "https://explorer.testnet.aurora.dev/",
    supported: false,
  },
  "11297108109": {
    apiURL: "https://explorer.palm.io/",
    supported: false,
  },
  "11297108099": {
    apiURL: "https://explorer.palm-uat.xyz/",
    supported: true,
  },
  "122": {
    apiURL: "https://explorer.fuse.io/",
    supported: true,
  },
  "9000": {
    apiURL: "https://evm.evmos.dev/",
    supported: false,
  },
  "9001": {
    apiURL: "https://evm.evmos.org/",
    supported: false,
  },
  "192837465": {
    apiURL: "https://explorer.gather.network/",
    supported: false,
  },
  "486217935": {
    apiURL: "https://devnet-explorer.gather.network/",
    supported: false,
  },
  "356256156": {
    apiURL: "https://testnet-explorer.gather.network/",
    supported: false,
  },
  "73799": {
    apiURL: "https://volta-explorer.energyweb.org/",
    supported: false,
  },
  "246": {
    apiURL: "https://explorer.energyweb.org/",
    supported: false,
  },
  "71401": {
    apiURL: "https://gw-testnet-explorer.nervosdao.community/",
    supported: false,
  },
  "71402": {
    apiURL: "https://gw-mainnet-explorer.nervosdao.community/",
    supported: false,
  },
  "103090": {
    apiURL: "https://scan.crystaleum.org/",
    supported: false,
  },
  "420666": {
    apiURL: "https://testnet-explorer.kekchain.com/",
    supported: false,
  },
  "420420": {
    apiURL: "https://mainnet-explorer.kekchain.com/",
    supported: false,
  },
  "7700": {
    apiURL: "https://tuber.build/",
    supported: false,
  },
  "7701": {
    apiURL: "https://testnet.tuber.build/",
    supported: true,
  },
  "99": {
    apiURL: "https://blockscout.com/poa/core/",
    supported: true,
  },
  "592": {
    apiURL: "https://blockscout.com/astar/",
    supported: false,
  },
  "10200": {
    apiURL: "https://blockscout.chiadochain.net/",
    supported: true,
  },
  "1001": {
    apiURL: "https://klaytn-testnet.blockscout.com/",
    supported: false,
  },
  "8217": {
    apiURL: "https://klaytn-mainnet.blockscout.com/",
    supported: false,
  },
  "336": {
    apiURL: "https://blockscout.com/shiden/",
    supported: false,
  },
  "28528": {
    apiURL: "https://blockscout.com/optimism/bedrock-alpha/",
    supported: false,
  },
  "7001": {
    apiURL: "https://blockscout.athens2.zetachain.com/",
    supported: false,
  },
  "42262": {
    apiURL: "https://explorer.emerald.oasis.dev/",
    supported: false,
  },
  "42261": {
    apiURL: "https://testnet.explorer.emerald.oasis.dev/",
    supported: false,
  },
  "23294": {
    apiURL: "https://explorer.sapphire.oasis.io/",
    supported: false,
  },
  "23295": {
    apiURL: "https://testnet.explorer.sapphire.oasis.dev/",
    supported: false,
  },
  "19": {
    apiURL: "https://songbird-explorer.flare.network/",
    supported: false,
  },
  "14": {
    apiURL: "https://flare-explorer.flare.network/",
    supported: false,
  },
  "2047": {
    apiURL: "https://web3-explorer-mesos.thestratos.org/",
    supported: false,
  },
  "641230": {
    apiURL: "https://brnkscan.bearnetwork.net/",
    supported: false,
  },
  "1149": {
    apiURL: "https://explorer.plexfinance.us/",
    supported: false,
  },
  "2000": {
    apiURL: "https://explorer.dogechain.dog/",
    supported: false,
  },
  "25925": {
    apiURL: "https://testnet.bkcscan.com/",
    supported: false,
  },
  "96": {
    apiURL: "https://bkcscan.com/",
    supported: false,
  },
  "1339": {
    apiURL: "https://blockscout.elysiumchain.tech/",
    supported: false,
  },
  "7777777": {
    apiURL: "https://explorer.zora.co/",
    supported: true,
  },
  "2222": {
    apiURL: "https://explorer.kava.io/",
    supported: false,
  },
  "2221": {
    apiURL: "https://explorer.testnet.kava.io/",
    supported: false,
  },
  "111000": {
    apiURL: "https://http://explorer.test.siberium.net/",
    supported: false,
  },
  "212": {
    apiURL: "https://testnet.maposcan.io/",
    supported: false,
  },
  "22776": {
    apiURL: "https://maposcan.io/",
    supported: false,
  },
  "2021": {
    apiURL: "https://edgscan.live/",
    supported: false,
  },
  "10243": {
    apiURL: "https://explorer-test.arthera.net/",
    supported: true,
  },
  "35441": {
    apiURL: "https://explorer.q.org/",
    supported: false,
  },
  "35443": {
    apiURL: "https://explorer.qtestnet.org/",
    supported: false,
  },
  "11235": {
    apiURL: "https://explorer.haqq.network/",
    supported: true,
  },
  "54211": {
    apiURL: "https://explorer.testedge2.haqq.network/",
    supported: true,
  },
};

type BlockscanAPIs = {
  [key: string]: {
    apiURL: string;
  };
};

export const blockscanAPIs: BlockscanAPIs = {
  "51": {
    apiURL: "https://apothem.blocksscan.io/",
  },
};

type MeterAPIs = {
  [key: string]: {
    apiURL: string;
  };
};

export const meterAPIs: MeterAPIs = {
  "82": {
    apiURL: "https://api.meter.io:8000/",
  },
  "81": {
    apiURL: "https://api.meter.io:4000/",
  },
};

type TelosAPIs = {
  [key: string]: {
    apiURL: string;
  };
};

export const telosAPIs: TelosAPIs = {
  "40": {
    apiURL: "https://mainnet.telos.net/",
  },
  "41": {
    apiURL: "https://testnet.telos.net/",
  },
};
