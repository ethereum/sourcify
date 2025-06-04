# sourcify-server

Sourcify's server for verifying Solidity and Vyper smart contracts.

The server uses [lib-sourcify](https://github.com/ethereum/sourcify/tree/main/packages/lib-sourcify) under the hood for contract verification logic. It provides REST API endpoints for users to submit new contracts for verification or retrieve verified contracts. The data is stored in a PostgreSQL database.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) (recommended v22)
- Postgres 16 (or Docker)

## Quick Start

First head to the project root directory then

1. Install

```bash
npm install
```

2. Build the monorepo's packages

```bash
npx lerna run build
```

3. Spin up a PostgreSQL database

Go to the `services/database`

```bash
cd services/database
```

Copy the `.env.template` file into a file named `.env`. Change values if they are different for your Postgres instance or use those defaults.

```bash
cp .env.template .env
```

Run Postgres with docker compose:

```bash
docker compose up -d
```

4. Pull the database schema from the [Verifier Alliance](https://github.com/verifier-alliance/database-specs) repository.

```bash
git submodule update --init --recursive
```

5. Run the migrations

Migrations will write the database schema for your instance using the credentials from the `.env` file.

```bash
npm run migrate:up -- --env dev
```

6. Go to the `services/server` directory to run the server.

```bash
cd ../server
```

Copy the `.env.dev` file into a file named `.env` and fill in the required values.

```bash
cp .env.dev .env
```

You can run without filling the optional values but to connect to some RPCs you need to add API keys as env vars. Check the `sourcify-chains-default.json` file if the chain you are interested in has an authenticated RPC or create your own `sourcify-chains.json` file. See [Chains Config](#chains-config) for more details.

7. Start the server

```bash
npm start
```

## Config

### Server Config

The server config is defined in [`src/config/default.js`](src/config/default.js).

To override the default config, you can create a `local.js` file and override the default config. The parameters are overridden one by one, so you only need to override the parameters you want to change.

Note that you need to set the read storage option to `RWStorageIdentifiers.SourcifyDatabase` and run a PostgreSQL database to make API v2 available. See [Database](#database).

Once you've written your own config, you must build the server again for changes to take effect:

```
npx lerna run build
```

Alternatively, if you are running in a deployment you can pass the `NODE_CONFIG_ENV` name as the config file name and it will take precedence. For example, if you are running in a `NODE_CONFIG_ENV=staging` environment, you can create a [`config/staging.js`](src/config/staging.js) file and it will be used instead of the default config. Local takes precedence over `NODE_CONFIG_ENV`. The file precedence is defined in [node-config package](https://github.com/node-config/node-config/wiki/Configuration-Files#multi-instance-deployments).

<details>
  <summary>**Full list of config options**</summary>

<!-- prettier-ignore-start -->
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
  session: { // deprecated, not part of API v2
    secret: process.env.SESSION_SECRET || "CHANGE_ME", // The secret used to sign the session cookie
    maxAge: 12 * 60 * 60 * 1000, // The maximum age of the session in milliseconds
    secure: false,
    // Where to save session data. Options: "memory" | "database"
    // - "memory": Sessions stored in server memory. Only use for testing/local development.
    // Sessions are lost when server restarts.
    // - "database": Sessions stored in PostgreSQL. Recommended for production.
    // Requires database setup (see Database section) and uses the `session` table.
    storeType: "memory",
  },
  // If true, downloads all production version compilers and saves them.
  initCompilers: false,
  // The origins that are allowed to access the server, regex allowed
  corsAllowedOrigins: [/^https?:\/\/(?:.+\.)?sourcify.dev$/],
  // verify-deprecated endpoint used in services/database/scripts.mjs. Used when recreating the DB with deprecated chains that don't have an RPC.
  verifyDeprecated: false,
};
```
<!-- prettier-ignore-end -->

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
      "supported": true, // required
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

There are two types of storages: `RWStorageIdentifiers` and `WStorageIdentifiers`. These are the possible options:

- `RWStorageIdentifiers.RepositoryV1` (deprecated) - the legacy repository that saves the source files and metadata as is inside a filesystem. A file system has many limitations and newer versions of the sourcify-server keeps it for backwards compatibility. If used as the `read` option, the `/v2` API endpoints won't be available. We don't recommend using this option.
- `WStorageIdentifiers.RepositoryV2` - a filesystem for serving source files and metadata on IPFS. Since pinning files on IPFS is done over a file system, Sourcify saves these files here. This repository does not save source file names as given in the metadata file (e.g. `contracts/MyContract.sol`) but saves each file with their keccak256 hash. This is done to avoid file name issues, as source file names can be arbitrary strings.

- `WStorageIdentifiers.AllianceDatabase` - the PostgreSQL for the [Verifier Alliance](https://verifieralliance.org) (optional)
- `RWStorageIdentifiers.SourcifyDatabase` - the PostgreSQL database that is an extension of the Verifier Alliance database. Required for API v2. See [Database](#database).

`RWStorageIdentifiers` can both be used as a source of truth (`read`) and store (`writeOr...`) the verified contracts. `WStorageIdentifiers` can only store (write) verified contracts. For instance, Sourcify can write to the [Verifier Alliance](https://verifieralliance.org) whenever it receives a verified contract, but this can't be the source of truth for the Sourcify APIs.

If you have an instance running on the legacy filesystem storage backend, see [docs](https://docs.sourcify.dev/docs/database-migration/) for migration instructions.

The following is an example of the storage config:

```js
  // The storage services where the verified contract will be saved and read from
  storage: {
    // read option will be the "source of truth" where the contracts read from for the API requests.
    read: RWStorageIdentifiers.SourcifyDatabase,
    // User request will NOT fail if saving to these fail, but only log a warning
    writeOrWarn: [
      WStorageIdentifiers.AllianceDatabase,
    ],
    // The user request will fail if saving to these fail
    writeOrErr: [
      WStorageIdentifiers.RepositoryV2,
      RWStorageIdentifiers.SourcifyDatabase,
    ],
  },
```

### Database

Sourcify's database schema is defined in the [services/database](../database/) and available as database migrations. To use the database, you need to run a PostgreSQL database and run the migrations to define its schema. See the [Database docs](https://docs.sourcify.dev/docs/repository/sourcify-database/) for more information.

## Docker

The images are published in the [Github Container Registry](https://github.com/ethereum/sourcify/pkgs/container/sourcify%2Fserver)

### Running the server with docker compose

There is a docker compose file which makes running the server locally easy:

```bash
cd ../..
docker compose -f ./services/server/docker-compose.local.yml up
```

The setup starts a postgres database, runs the needed database migrations, and starts the Sourcify server with port 5555 exposed to your local machine.

The server will use your local config (`./src/config/local.js`) and env file (`.env`). You can modify the docker compose file to also add a custom `sourcify-chains.json` for example.

### Building the image

If you want to build the image yourself, the builds need to be run from the project root context, e.g.:

```bash
cd sourcify/ && docker build -f services/server/Dockerfile .
```

### Running the image directly

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

### Connecting to a node on the host

The following feature is only supported on Docker Desktop for Mac and Windows: If you are running an RPC server for a chain on the Docker host, you can have your Sourcify container connect to it by using `host.docker.internal` as the hostname (or `host.containers.internal` if using Podman instead of Docker). For example, if the RPC server is accessible on the host at `http://localhost:8545`, configure the RPC's URL in `sourcify-chains.json` as `http://host.docker.internal:8545`.

## Logging

By default the server logs `info` level when `NODE_ENV=production` and `debug` otherwise.

It is possible to set a custom logging level with the environment variable `NODE_LOG_LEVEL` when starting the server.

Another possibility is the authenticated endpoint `/private/change-log-level`. Sending a `POST` with `{ "level": "debug" }` will set the new logging level dynamically, given the `SOURCIFY_PRIVATE_TOKEN` matches the header `authorization = Bearer <token-value>`. This is particularly useful in production for debugging and tracing purposes.
