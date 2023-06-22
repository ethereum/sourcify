/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
import path from "path";
import { SourcifyEventManager } from "./common/SourcifyEventManager/SourcifyEventManager";
import { logger } from "./common/loggerLoki";

dotenv.config({ path: path.resolve(__dirname, "..", "environments/.env") });

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
  "288": {
    apiURL: "https://api.bobascan.com",
    apiKey: process.env.BOBASCAN_API_KEY,
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
};
