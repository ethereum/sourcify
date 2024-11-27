const {
  RWStorageIdentifiers,
  WStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  serverUrl: "https://staging.sourcify.dev/server",
  server: {
    port: 80,
  },
  storage: {
    read: RWStorageIdentifiers.SourcifyDatabase,
    writeOrWarn: [
      WStorageIdentifiers.S3Repository,
      RWStorageIdentifiers.RepositoryV1,
    ],
    writeOrErr: [
      WStorageIdentifiers.RepositoryV2,
      RWStorageIdentifiers.SourcifyDatabase,
    ],
  },
  repositoryV1: {
    path: "/home/app/data/repository",
  },
  repositoryV2: {
    path: "/home/app/data/repositoryV2",
  },
  solcRepo: "/home/app/data/compilers/solc",
  solJsonRepo: "/home/app/data/compilers/soljson",
  session: {
    secure: true, // Set Secure in the Set-Cookie header i.e. require https
    storeType: "database",
  },
  lambdaCompiler: {
    enabled: false,
    functionName: "compile:3",
    // credentials as env vars
  },
  rateLimit: {
    enabled: false,
    windowMs: 1 * 1000, // 1 sec
    max: 2,
  },
};
