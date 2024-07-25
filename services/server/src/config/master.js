const {
  RWStorageIdentifiers,
  WStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  server: {
    port: 80,
  },
  storage: {
    read: RWStorageIdentifiers.RepositoryV1,
    writeOrWarn: [
      // WStorageIdentifiers.AllianceDatabase,
      RWStorageIdentifiers.RepositoryV1,
    ],
    writeOrErr: [
      WStorageIdentifiers.RepositoryV2,
      // RWStorageIdentifiers.SourcifyDatabase,
    ],
  },
  repositoryV1: {
    path: "/home/app/repository",
    serverUrl: "https://repo.sourcify.dev",
  },
  repositoryV2: {
    path: "/home/app/repositoryV2",
  },
  solcRepo: "/data/compilers/solc",
  solJsonRepo: "/data/compilers/soljson",
  session: {
    secure: true, // Set Secure in the Set-Cookie header i.e. require https
    storeType: "database",
  },
  lambdaCompiler: {
    enabled: true,
    functionName: "compile-production:3",
    // credentials as env vars
  },
  rateLimit: {
    enabled: true,
    windowMs: 1 * 1000, // 1 sec
    max: 2,
  },
};
