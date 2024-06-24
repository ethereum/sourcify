const {
  WStorageIdentifiers,
  RWStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  server: {
    port: 5555,
    maxFileSize: 30 * 1024 * 1024, // 30 MB
  },
  // The storage services where the verified contract be saved and read from
  storage: {
    // read option will be the "source of truth" where the contracts read from for the API requests.
    read: RWStorageIdentifiers.SourcifyDatabase,
    // User request will NOT fail if saving to these fail, but only log a warning
    writeOrWarn: [
      WStorageIdentifiers.AllianceDatabase,
      RWStorageIdentifiers.RepositoryV1,
    ],
    // The user request will fail if saving to these fail
    writeOrErr: [
      WStorageIdentifiers.RepositoryV2,
      RWStorageIdentifiers.SourcifyDatabase,
    ],
  },
  // Legacy repository
  repositoryV1: {
    path: "/tmp/sourcify/repository",
    serverUrl: "http://localhost:10000", // Need to keep this as it's used in IpfsRepositoryService.ts fetchAllFileUrls.
  },
  repositoryV2: {
    path: "/tmp/sourcify/repositoryV2",
  },
  solcRepo: "/tmp/solc-bin/linux-amd64",
  solJsonRepo: "/tmp/solc-bin/soljson",
  session: {
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    maxAge: 12 * 60 * 60 * 1000, // 12 hrs in millis
    secure: false, // Set Secure in the Set-Cookie header i.e. require https
    storeType: "memory", // Where to save the session info. "memory" is only good for testing and local development. Don't use it in production!
  },
  // It is possible to outsource the compilation to a lambda function instead of running locally. Turned on in production.
  // Requires env vars AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
  lambdaCompiler: {
    enabled: false,
    // functionName: "compile",
  },
  corsAllowedOrigins: [
    /^https?:\/\/(?:.+\.)?sourcify.dev$/, // sourcify.dev and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth$/, // sourcify.eth and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth.link$/, // sourcify.eth.link and subdomains
    /^https?:\/\/(?:.+\.)?ipfs.dweb.link$/, // dweb links used by Brave browser etc.
    process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(?::\d+)?$/, // localhost on any port
  ],
  rateLimit: {
    enabled: false,
    // Check done with "startsWith"
    whitelist: [
      "10.", // internal IP range
      "::ffff:10.",
      "127.0.0.1",
      "::ffff:127.0.0.1",
      "::1",
    ],
  },
};
