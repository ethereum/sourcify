# sourcify-server

Sourcify's server for verifying contracts.

## Config

The chains supported by the Sourcify server are defined in `src/sourcify-chains-default.json`.

To support a different set of chains, you can create a `src/sourcify-chains.json` file and override the default chains.

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

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v16)

### Environment Variables

Copy the `.env.dev` file into a file named `.env` and fill in the values.

### Running

```bash
npm install
npm start
```

## Docker

We provide a `docker-compose.yml` file for convenience.

To run in a container you can use this compose file and provide these environment variables for your host machine:

```bash
DOCKER_HOST_SERVER_PORT=
DOCKER_HOST_SOLC_REPO=
DOCKER_HOST_SOLJSON_REPO=
DOCKER_HOST_REPOSITORY_PATH=
```

Also update these as these will be different in the container than in your host machine:

```bash
SERVER_PORT=5555
SOLC_REPO=/data/solc-bin/linux-amd64
SOLJSON_REPO=/data/solc-bin/soljson
REPOSITORY_PATH=/data/repository
```

If you want to modify the chains supported by the server, you can mount a custom `sourcify-chains.json` file:

```yaml
volumes:
  - path/to/custom/sourcify-chains.json:/home/app/services/server/dist/sourcify-chains.json
```

Then run:

```bash
docker-compose up
```
