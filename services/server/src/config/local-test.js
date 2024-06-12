const {
  SourcifyDatabaseIdentifier,
  RepositoryV1Identifier,
  RepositoryV2Identifier,
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
    read: SourcifyDatabaseIdentifier,
    writeOrWarn: [RepositoryV1Identifier],
    writeOrErr: [RepositoryV2Identifier, SourcifyDatabaseIdentifier],
  },
};
