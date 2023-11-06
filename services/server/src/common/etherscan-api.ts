export type EtherscanAPIs = {
  [key: string]: {
    apiURL: string;
    apiKey: string;
  };
};

export const etherscanAPIs: EtherscanAPIs = {
  "1": {
    apiURL: "https://api.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  "17000": {
    apiURL: "https://api-holesky.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  "5": {
    apiURL: "https://api-goerli.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  "11155111": {
    apiURL: "https://api-sepolia.etherscan.io",
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  "42161": {
    apiURL: "https://api.arbiscan.io",
    apiKey: process.env.ARBISCAN_API_KEY || "",
  },
  "421613": {
    apiURL: "https://api-goerli.arbiscan.io",
    apiKey: process.env.ARBISCAN_API_KEY || "",
  },
  "10": {
    apiURL: "https://api-optimistic.etherscan.io",
    apiKey: process.env.OPTIMISMSCAN_API_KEY || "",
  },
  "420": {
    apiURL: "https://api-goerli-optimism.etherscan.io",
    apiKey: process.env.OPTIMISMSCAN_API_KEY || "",
  },
  "43114": {
    apiURL: "https://api.snowtrace.io",
    apiKey: process.env.SNOWTRACE_API_KEY || "",
  },
  "43113": {
    apiURL: "https://api-testnet.snowtrace.io",
    apiKey: process.env.SNOWTRACE_API_KEY || "",
  },
  "56": {
    apiURL: "https://api.bscscan.com",
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
  "97": {
    apiURL: "https://api-testnet.bscscan.com",
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
  "137": {
    apiURL: "https://api.polygonscan.com",
    apiKey: process.env.POLYGONSCAN_API_KEY || "",
  },
  "80001": {
    apiURL: "https://api-testnet.polygonscan.com",
    apiKey: process.env.POLYGONSCAN_API_KEY || "",
  },
  "42220": {
    apiURL: "https://api.celoscan.io",
    apiKey: process.env.CELOSCAN_API_KEY || "",
  },
  "44787": {
    apiURL: "https://api-alfajores.celoscan.io",
    apiKey: process.env.CELOSCAN_API_KEY || "",
  },
  "1284": {
    apiURL: "https://api-moonbeam.moonscan.io",
    apiKey: process.env.MOONSCAN_MOONBEAM_API_KEY || "",
  },
  "1285": {
    apiURL: "https://api-moonriver.moonscan.io",
    apiKey: process.env.MOONSCAN_MOONRIVER_API_KEY || "",
  },
  // Does not require API key
  "1287": {
    apiURL: "https://api-moonbase.moonscan.io",
    apiKey: "",
  },
  "100": {
    apiURL: "https://api.gnosisscan.io",
    apiKey: process.env.GNOSSISCAN_API_KEY || "",
  },
  "25": {
    apiURL: "https://api.cronoscan.com/",
    apiKey: process.env.CRONOSCAN_API_KEY || "",
  },
  // Does not require API key
  "84531": {
    apiURL: "https://api-goerli.basescan.org/",
    apiKey: "",
  },
  "8453": {
    apiURL: "https://api.basescan.org/",
    apiKey: process.env.BASESCAN_API_KEY || "",
  },
  "1116": {
    apiURL: "https://openapi.coredao.org/",
    apiKey: process.env.COREDAO_API_KEY || "",
  },
};
