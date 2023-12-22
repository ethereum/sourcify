module.exports = {
  server: {
    port: 80,
  },
  repository: {
    path: "/home/app/repository",
    serverUrl: "https://repo.staging.sourcify.dev",
  },
  solcRepo: "/home/app/compilers/solc",
  solJsonRepo: "/home/app/compilers/soljson",
  session: {
    secure: true, // Set Secure in the Set-Cookie header i.e. require https
  },
  lambdaCompiler: {
    enabled: true,
    functionName: "compile",
    // credentials as env vars
  },
  rateLimit: {
    enabled: true,
  },
};
