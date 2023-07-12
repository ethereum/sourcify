# lib-sourcify

[![codecov](https://codecov.io/gh/ethereum/sourcify/branch/staging/graph/badge.svg?token=eN6XDAwWfV&flag=lib-sourcify)](https://codecov.io/gh/ethereum/sourcify)

lib-sourcify is [Sourcify](https://sourcify.dev)'s reusable backbone library for verifying contracts. Additionally it contains:

- contract validation methods for creating `CheckedContract`s
  - an abstraction for a contract ready to be compiled and verified: fetching and assembling its source files, compiling etc.
- Sourcify types and interfaces

## Validation

The initial step to verify a contract is to validation, i.e. creating a `CheckedContract`. This can be done with `checkFiles` which takes files in `PathBuffer` as input and outputs a `CheckedContract` array:

```ts
const pathBuffers: PathBuffer[] = [];
pathBuffers.push({
  path: filePath,
  buffer: fs.readFileSync(filePath),
});
```

For a `CheckedContract` to be valid i.e. compilable, you need to provide a [contract metadata JSON](https://docs.soliditylang.org/en/latest/metadata.html) file identifying the contract and the source files of the contract listed under the `sources` field of the metadata.

```ts
const checkedContracts: CheckedContract[] = await checkFiles(pathBuffers);
```

Each contract source either has a `content` field containing the Solidity code as a string, or urls to fetch the sources from (Github, IPFS, Swarm etc.). If the contract sources are available, you can fetch them with.

```ts
CheckedContract.fetchMissing(checkedContracts[0]); // static method
```

You can check if a contract is ready to be compiled with:

```ts
CheckedContract.isValid(checkedContracts[0]); // true
```

## Verification

A contract verification essentially requires a `CheckedContract` and an on-chain contract to compare against the `CheckedContract`.

### Deployed Contract

You can verify a deployed contract with:

```ts
export async function verifyDeployed(
  checkedContract: CheckedContract,
  sourcifyChain: SourcifyChain,
  address: string,
  creatorTxHash?: string
): Promise<Match>;
```

a `SourcifyChain` here is the chain object of [ethereum-lists/chains](https://chainid.network/chains.json). This states which chain to look the contract in (e.g. `chainId`) and through which `rpc`s to retrieve the deployed contract from.

```ts
const goerliChain =   {
  name: "Goerli",
  rpc: [
    "https://locahlhost:8545/"
    "https://goerli.infura.io/v3/${INFURA_API_KEY}",
  ],
  chainId: 5,
},

const match = verifyDeployed(
  checkedContract[0],
  goerliChain,
  '0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4'
)

console.log(match.status) // 'perfect'
```

### Create2 Contract

Alternatively you can verify counterfactual contracts created with the [CREATE2](https://eips.ethereum.org/EIPS/eip-1014) opcode. This does not require a `SourcifyChain` and `address` as the contract address is pre-deterministicly calculated and the contract is not necessarily deployed.

```ts
export async function verifyCreate2(
  checkedContract: CheckedContract,
  deployerAddress: string,
  salt: string,
  create2Address: string,
  abiEncodedConstructorArguments?: string
): Promise<Match>;
```

Example:

```ts
const match = await verifyCreate2(
  checkedContract[0],
  deployerAddress,
  salt,
  create2Address,
  abiEncodedConstructorArguments
);

console.log(match.chainId); // '0'. create2 matches return 0 as chainId
console.log(match.status); // 'perfect'
```

## Logging

`lib-sourcify` has a basic logging system.

You can specify the log level using the `setLibSourcifyLoggerLevel(level)` where:

- `0` is nothing
- `1` is errors
- `2` is warnings _[default]_
- `3` is infos
- `4` is debug

You can override the logger by calling `setLogger(logger: ILibSourcifyLogger)`. This is an example:

```javascript
const winston = require('winston');
const logger = winston.createLogger({
  // ...
});

setLibSourcifyLogger({
  logLevel: 4,
  setLevel(level: number) {
    this.logLevel = level;
  },
  log(level, msg) {
    if (level <= this.logLevel) {
      switch (level) {
        case 1:
          logger.error(msg);
          break;
        case 2:
          logger.warn(msg);
          break;
        case 3:
          logger.info(msg);
          break;
        case 4:
          logger.debug(msg);
          break;
      }
    }
  },
});
```
