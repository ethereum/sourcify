module.exports = {
  port: 80,
  repository: {
    path: "/home/app/repository",
    serverUrl: "https://repo.sourcify.dev",
  },
  solcRepo: "/data/compilers/solc",
  solJsonRepo: "/data/compilers/soljson",
  session: {
    secure: true, // Set Secure in the Set-Cookie header i.e. require https
  },
  lambdaCompiler: {
    enabled: true,
    functionName: "compiler-production",
    // credentials as env vars
  },
  rateLimit: {
    enabled: true,
  },
};
