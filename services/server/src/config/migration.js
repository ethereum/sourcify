const {
  RWStorageIdentifiers,
  WStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  server: {
    port: 80,
  },
  repositoryV1: {
    path: "/home/app/repository",
    serverUrl: "https://repo.staging.sourcify.dev",
  },
  repositoryV2: {
    path: "/home/app/repositoryV2",
  },
  // The storage services where the verified contract be saved and read from
  storage: {
    read: RWStorageIdentifiers.SourcifyDatabase,
    writeOrWarn: [],
    writeOrErr: [
      WStorageIdentifiers.RepositoryV2,
      RWStorageIdentifiers.RepositoryV1,
      RWStorageIdentifiers.SourcifyDatabase,
    ],
  },
  solcRepo: "/home/app/compilers/solc",
  solJsonRepo: "/home/app/compilers/soljson",
  session: {
    secure: true, // Set Secure in the Set-Cookie header i.e. require https
  },
  lambdaCompiler: {
    enabled: false,
    functionName: "compile",
    // credentials as env vars
  },
  rateLimit: {
    enabled: false,
    windowMs: 1 * 1000, // 1 sec
    max: 2,
  },
};
