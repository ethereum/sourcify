# sourcify-monitor

Sourcify Monitor is a standalone service that listens to various EVM chains for new contract creations and automatically submits them to the Sourcify API for verification.

This is only possible for Solidity contracts that has its metadata hash published in a DecentralizedStorage (IPFS, Swarm, etc). Currently only IPFS is supported.

Learn more about the contract metadata in the [Solidity docs](https://docs.soliditylang.org/en/latest/metadata.html) and [Sourcify docs](https://docs.sourcify.dev/docs/metadata/). We also have a nice playground showing everthing in action at [playground.sourcify.dev](https://playground.sourcify.dev).

## Config

### Chains to Monitor

First you need to provide which chains to monitor in a json file.

```json
[
  {
    "chainId": 1,
    "name": "Ethereum Mainnet",
    "rpc": ["http://localhost:8545", "https://mainnet.infura.io/v3/{INFURA_API_KEY}"],
  },
  {
    "chainId": 11155111,
    "name": "Ethereum Sepolia Testnet",
    "rpc": ["http://localhost:8545", "https://rpc2.sepolia.org/ "],
  },
  ...
]
```

Infura and Alchemy keys must be formatted as above in `{}`

See [chains.json](./chains.json) for a full example and to see which chains we monitor ourselves. You can also use the [chainid.network/chains.json](https://chainid.network/chains.json) to find chains.

### Monitor Config

Optionally you can pass a monitor config in a `config.json` file. If you don't, the [default config](src/defaultConfig.js) will be used. If you leave any field blank, it will be filled with the default config.

The structure of the file is as such:

```js
  decentralizedStorages: {
    ipfs: {
      enabled: true,
      gateways: ["https://ipfs.io/ipfs/", "http://localhost:8080/ipfs/"],
      // Time when the request to the gateway will timeout i.e. canceled in ms
      timeout: 30000,
      // Time between each request to the gateway in ms
      interval: 5000,
      // Number of retries before giving up
      retries: 5,
    },
    // can also have swarm
  },
  // Sourcify instances to verify the contracts on. Can be multiple
  sourcifyServerURLs: ["https://sourcify.dev/server/", "http://localhost:5555/"],
  defaultChainConfig: {
    // Block to start monitoring from. If undefined, it will start from the latest block by asking the RPC `eth_blockNumber`
    startBlock: undefined,
    // Time between each block check in ms. This value is dynamically adjusted based on the block time.
    // When a block is successfully fetched, it's decreased by `blockIntervalFactor`, and vice versa.
    blockInterval: 10000,
    // The factor to increase/decrease the block interval by. Must be greater than 1.
    blockIntervalFactor: 1.1,
    // The upper and lower limit of the block interval in ms
    blockIntervalUpperLimit: 300000,
    blockIntervalLowerLimit: 100,
    // Time between each `eth_getCode` requets in ms
    bytecodeInterval: 5000,
    // Number of retries before giving up getting the contract bytecode.
    bytecodeNumberOfTries: 5,
  },
  // Can also pass each chain the same config as above. Non specified fields will be filled with the defaultChainConfig. Non specified chains will use the whole defaultChainConfig.
  chainConfigs: {
    1: {
      startBlock: 10000000,
      blockInterval: 12000, // Ethereum mainnet is set to 12s
    }
  }
```

### Environment variables

By default you can pass the following environment variables in `.env.template` for authenticating with the RPCs:

```bash
# If your RPCs are Alchemy or Infura
# In the rpc url it must have {INFURA_API_KEY} or {ALCHEMY_API_KEY}
ALCHEMY_API_KEY=
INFURA_API_KEY=

# ethpandaops.io authentication
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
```

## Usage

The recommended way to run the Sourcify Monitor is via Docker.

You need to pass the `chains.json` and `config.json` files to the container. You can do this by mounting them as volumes:

```bash
docker run \
  -v /path/to/chains.json:/home/app/services/monitor/chains.json \
  -v /path/to/config.json:/home/app/services/monitor/config.json \
  -e ALCHEMY_API_KEY=xxx \
  -e INFURA_API_KEY=xxx \
  ethereum/source-verify:monitor-stable
```

The containers are at [Docker Hub](https://hub.docker.com/r/ethereum/source-verify/tags).

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) v18 or higher

### Install dependencies

Clone the [Sourcify monorepo](https://github.com/ethereum/sourcify)

```bash
git clone git@github.com:ethereum/sourcify.git
cd sourcify
```

Add environment variables to `.env.template` and rename it to `.env`

```bash
ALCHEMY_API_KEY=
INFURA_API_KEY=
```

```bash
npm install && npx lerna run build
```

```bash
cd services/monitor
npm start
```
