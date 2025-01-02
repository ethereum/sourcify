# sourcify-server

Sourcify's server for verifying contracts.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v22)
- (Optional) Postgres (See [Choosing the storage backend](#choosing-the-storage-backend))
- (Optional) Docker and docker-compose for tests

## Quick Start

1. Install

```bash
npm install
```

2. Change the server storage backend to a filesystem for easy start. Create a `src/config/local.js`:

See the [Config](#config) section below for details.

```js
const {
  RWStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  storage: {
    read: RWStorageIdentifiers.RepositoryV1,
    writeOrWarn: [],
    writeOrErr: [RWStorageIdentifiers.RepositoryV1],
  },
};
```

3. Build the monorepo's packages

```bash
npx lerna run build
```

4. Copy the `.env.dev` file into a file named `.env` and fill in the values. You can run without filling values but to connect to RPCs you need to add keys or change [Chains config](#chains-config).

5. Start

```bash
cd services/server
npm start
```

## Config

### Server Config

The server config is defined in [`src/config/default.js`](src/config/default.js).

To override the default config, you can create a `local.js` file and override the default config. The parameters are overridden one by one, so you only need to override the parameters you want to change.

Once you've written your own config, you must build the server again for changes to take effect:

```
npx lerna run build
```

Alternatively, if you are running in a deployment you can pass the `NODE_CONFIG_ENV` name as the config file name and it will take precedence. For example, if you are running in a `NODE_CONFIG_ENV=staging` environment, you can create a [`config/staging.js`](src/config/staging.js) file and it will be used instead of the default config. Local takes precedence over `NODE_CONFIG_ENV`. The file precedence is defined in [node-config package](https://github.com/node-config/node-config/wiki/Configuration-Files#multi-instance-deployments).

<details>
  <summary>**Full list of config options**</summary>
  
```js
const {
  WStorageIdentifiers,
  RWStorageIdentifiers,
} = require("../server/services/storageServices/identifiers");

module.exports = {
  serverUrl: "http://sourcify.dev/server", // The public URL of the server
  server: {
    port: 5555, // The port the server will run on
    maxFileSize: 30 * 1024 * 1024, // The maximum uploaded file size in bytes
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
  repositoryV1: {
    path: "/tmp/sourcify/repository", // The path to the repositoryV1 on the filesystem
  },
  repositoryV2: {
    path: "/tmp/sourcify/repositoryV2", // The path to the repositoryV2 on the filesystem
  },
  solcRepo: "/tmp/solc-bin/linux-amd64", // The path to the solc binaries on the filesystem
  solJsonRepo: "/tmp/solc-bin/soljson", // The path to the solJson binaries on the filesystem
  vyperRepo: "/tmp/vyper-bin/linux-amd64", // The path to the vyper binaries on the filesystem
  session: {
    secret: process.env.SESSION * SECRET || "CHANGE_ME", // The secret used to sign the session cookie
    maxAge: 12 * 60 * 60 * 1000, // The maximum age of the session in milliseconds
    secure: false, //
    storeType: "memory", // Where to save the session info. "memory" is only good for testing and local development. Don't use it in production!
  },
  // If true, downloads all production version compilers and saves them.
  initCompilers: false,
  // The origins that are allowed to access the server, regex allowed
  corsAllowedOrigins: [/^https?:\/\/(?:.+\.)?sourcify.dev$/],
  // verify-deprecated endpoint used in services/database/scripts.mjs. Used when recreating the DB with deprecated chains that don't have an RPC.
  verifyDeprecated: false,
  rateLimit: {
    enabled: false,
    // Maximum number (max) of requests allowed per IP address within the specified time window (windowMs)
    max: 100,
    windowMs: 10 * 60 * 1000,
    // List of IP addresses that are whitelisted from rate limiting
    whitelist: ["127.0.0.1"],
  },
};
```
</details>

### Chains Config

The chains supported by the Sourcify server are defined in `src/sourcify-chains-default.json`.

To support a different set of chains, you can create a `src/sourcify-chains.json` file and completely override the default chains.

A full example of a chain entry is as follows:

```json
{
  // the chain id
  "1": {
    "sourcifyName": "Ethereum Mainnet", // required
    "supported": true, // required
    // optional
    "etherscanApi": {
      "apiURL": "https://api.etherscan.io",
      "apiKeyEnvName": "ETHERSCAN_API_KEY" // the name of the environment variable holding the api key
    },
    // optional
    "fetchContractCreationTxUsing": {
      // How to find the transaction hash that created the contract
      "etherscanApi": true, // if supported by the new etherscan api. Need to provide the etherscanApi config
      "blockscoutApi": {
        // blockscout v2 instances have an api endpoint for this
        "url": "https://gnosis.blockscout.com/"
      },
      "blockscoutScrape": {
        // scraping from old (server-side rendered) blockscour ui
        "url": "https://scan.pulsechain.com/"
      },
      "avalancheApi": true // avalanche subnets at glacier-api.avax.network have an api endpoint for this
    },
    // optional. If not provided, the default rpc will be the ones from chains.json i.e. chainid.network/chains.json
    "rpc": [
      "https://rpc.sepolia.io", // can be a simple url
      {
        "type": "FetchRequest", // ethers.js FetchRequest for header authenticated RPCs
        "url": "https://rpc.mainnet.ethpandaops.io",
        "headers": [
          {
            "headerName": "CF-Access-Client-Id",
            "headerEnvName": "CF_ACCESS_CLIENT_ID"
          },
          {
            "headerName": "CF-Access-Client-Secret",
            "headerEnvName": "CF_ACCESS_CLIENT_SECRET"
          }
        ]
      },
      {
        "type": "APIKeyRPC", // Alchemy RPCs
        "url": "https://eth-mainnet.alchemyapi.io/v2/{API_KEY}",
        "apiKeyEnvName": "ALCHEMY_API_KEY"
      },
      {
        "type": "APIKeyRPC", // Infura RPCs
        "url": "https://palm-mainnet.infura.io/v3/{API_KEY}",
        "apiKeyEnvName": "INFURA_API_KEY"
      }
    ]
  }
}
```

### Choosing the storage backend

sourcify-server can use either a PostgreSQL database or a filesystem as its storage backend. This can be configured in the config file under the `storage` field:

```js
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
```

There are two types of storages: `RWStorageIdentifiers` and `WStorageIdentifiers`. These are the possible options:

- `RWStorageIdentifiers.RepositoryV1` - the legacy repository that saves the source files and metadata as is inside a filesystem. A file system has many limitations and newer versions of the sourcify-server keeps it for backwards compatibility.
- `WStorageIdentifiers.RepositoryV2` - a filesystem for serving source files and metadata on IPFS. Since pinning files on IPFS is done over a file system, Sourcify saves these files here. This repository does not save source file names as given in the metadata file (e.g. `contracts/MyContract.sol`) but saves each file with their keccak256 hash. This is done to avoid file name issues, as source file names can be arbitrary strings.

- `WStorageIdentifiers.AllianceDatabase` - the PostgreSQL for the [Verifier Alliance](https://verifieralliance.org)
- `RWStorageIdentifiers.SourcifyDatabase` - the PostgreSQL database that is an extension of the Verifier Alliance database.

`RWStorageIdentifiers` can both be used as a source of truth (`read`) and store (`writeOr...`) the verified contracts. `WStorageIdentifiers` can only store (write) verified contracts. For instance, Sourcify can write to the [Verifier Alliance](https://verifieralliance.org) whenever it receives a verified contract, but this can't be the source of truth for the Sourcify APIs.

### Database

Sourcify's database schema is defined in the [services/database](../database/) and available as database migrations. To use the database, you need to run a PostgreSQL database and run the migrations to define its schema. See the [database README](../database/) for more information.

## Docker

If you want to build yourself, the builds need to be run from the project root context, e.g.:

```bash
cd sourcify/ && docker build -f services/server/Dockerfile .
```

The containers are published in the [Github Container Registry](https://github.com/ethereum/sourcify/pkgs/container/sourcify%2Fserver)

You can run the server using Docker and pass in a custom `sourcify-chains.json` (see above [Chains Config](#chains-config)) and `local.js` (see above [Server Config](#server-config)) config file.

Also set up the environment variables in the `.env` file. You can see the list of required environment variables in the `.env.dev` file. Pass it with the `--env-file` flag or use the `--env` flag to pass individual environment variables.

```bash
$ docker pull ghcr.io/ethereum/sourcify/server:latest
$ docker run \
  -p 5555:5555 \
  -v path/to/custom/sourcify-chains.json:/home/app/services/server/dist/sourcify-chains.json \
  -v path/to/custom/config.js:/home/app/services/server/dist/config/local.js \
  --env-file .env \
  ghcr.io/ethereum/sourcify/server:latest
```

## Logging

By default the server logs `info` level when `NODE_ENV=production` and `debug` otherwise.

It is possible to set a custom logging level with the environment variable `NODE_LOG_LEVEL` when starting the server.

Another possibility is the authenticated endpoint `/change-log-level`. Sending a `POST` with `{ "level": "debug" }` will set the new logging level dynamically, given the `SETLOGGING_TOKEN` matches the header `authorization = Bearer <token-value>`. This is particularly useful in production for debugging and tracing purposes.
