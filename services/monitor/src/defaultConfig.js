const defaultConfig = {
  decentralizedStorages: {
    ipfs: {
      enabled: true,
      gateways: ["https://ipfs.io/ipfs/"],
      timeout: 30000,
      interval: 5000,
      retries: 5,
    },
  },
  sourcifyServerURLs: ["https://sourcify.dev/server/"],
  defaultChainConfig: {
    startBlock: undefined,
    blockInterval: 10000,
    blockIntervalFactor: 1.1,
    blockIntervalUpperLimit: 300000,
    blockIntervalLowerLimit: 100,
    bytecodeInterval: 5000,
    bytecodeNumberOfTries: 5,
  },
};

export default defaultConfig;
