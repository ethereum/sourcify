module.exports = {
  server: {
    port: 5555,
    maxFileSize: 30 * 1024 * 1024, // 30 MB
  },
  repository: {
    path: "/tmp/sourcify/repository",
    serverUrl: "http://localhost:10000", // Need to keep this as it's used in IpfsRepositoryService.ts fetchAllFileUrls.
  },
  solcRepo: "/tmp/solc-bin/linux-amd64",
  solJsonRepo: "/tmp/solc-bin/soljson",
  session: {
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    maxAge: 12 * 60 * 60 * 1000, // 12 hrs in millis
    secure: false, // Set Secure in the Set-Cookie header i.e. require https
  },
  corsAllowedOrigins: [
    /^https?:\/\/(?:.+\.)?sourcify.dev$/, // sourcify.dev and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth$/, // sourcify.eth and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth.link$/, // sourcify.eth.link and subdomains
    /^https?:\/\/(?:.+\.)?ipfs.dweb.link$/, // dweb links used by Brave browser etc.
    process.env.NODE_ENV === "development" && /^https?:\/\/localhost(?::\d+)?$/, // localhost on any port
  ],
  rateLimit: {
    enabled: false,
    whitelist: [
      "10.", // internal IP range
      "127.0.0.1",
      "::ffff:127.0.0.1",
      "::1",
    ],
  },
};
