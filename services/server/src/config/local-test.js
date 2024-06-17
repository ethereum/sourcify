const {
  StorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  repositoryV1: {
    path: "/tmp/repositoryV1-test/",
  },
  repositoryV2: {
    path: "/tmp/repositoryV2-test/",
  },
  session: {
    storeType: "database",
  },
  storage: {
    read: StorageIdentifiers.SourcifyDatabase,
    writeOrWarn: [StorageIdentifiers.RepositoryV1],
    writeOrErr: [
      StorageIdentifiers.RepositoryV2,
      StorageIdentifiers.SourcifyDatabase,
    ],
  },
};
