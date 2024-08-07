const {
  RWStorageIdentifiers,
  WStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  server: {
    port: 80,
  },
  storage: {
    read: RWStorageIdentifiers.SourcifyDatabase,
    writeOrWarn: [
      // WStorageIdentifiers.AllianceDatabase,
      RWStorageIdentifiers.RepositoryV1,
    ],
    writeOrErr: [
      WStorageIdentifiers.RepositoryV2,
      RWStorageIdentifiers.SourcifyDatabase,
    ],
  },
  repositoryV1: {
    path: "/home/app/data/repository",
    serverUrl: "https://repo.staging.sourcify.dev",
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
    enabled: true,
    windowMs: 1 * 1000, // 1 sec
    max: 2,
  },
};
