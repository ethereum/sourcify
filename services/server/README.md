# sourcify-server

Sourcify's server for verifying contracts.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v22)
- Install the monorepo: `npm install` in the root of the repo
- Build the monorepo's packages: `npx lerna run build`

### Environment Variables

Copy the `.env.dev` file into a file named `.env` and fill in the values.

### Running

```bash
cd services/server
npm start
```

## Config

### Server Config

The server config is defined in [`src/config/default.js`](src/config/default.js).

To override the default config, you can create a `local.js` file and override the default config. The parameters are overridden one by one, so you only need to override the parameters you want to change.

Or if you are running in a deployment you can pass the `NODE_CONFIG_ENV` name as the config file name and it will take precedence. For example, if you are running in a `NODE_CONFIG_ENV=staging` environment, you can create a [`config/staging.js`](src/config/staging.js) file and it will be used instead of the default config. Local takes precedence over `NODE_CONFIG_ENV`. The file precedence is defined in [node-config package](https://github.com/node-config/node-config/wiki/Configuration-Files#multi-instance-deployments).

Note that this requires building the project. The config files are copied to the `dist` folder during the build process. See [Docker](#docker) for running directly.

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
        "type": "Alchemy", // Alchemy RPCs
        "url": "https://eth-mainnet.alchemyapi.io/v2/{ALCHEMY_API_KEY}",
        "apiKeyEnvName": "ALCHEMY_API_KEY"
      },
      {
        "type": "Infura", // Infura RPCs
        "url": "https://palm-mainnet.infura.io/v3/{INFURA_API_KEY}",
        "apiKeyEnvName": "INFURA_API_KEY"
      }
    ]
  }
}
```

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
