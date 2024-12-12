# lib-sourcify

[![codecov](https://codecov.io/gh/ethereum/sourcify/branch/staging/graph/badge.svg?token=eN6XDAwWfV&flag=lib-sourcify)](https://codecov.io/gh/ethereum/sourcify)

lib-sourcify is [Sourcify](https://sourcify.dev)'s reusable backbone library for verifying contracts. Additionally it contains:

- support for both Solidity and Vyper contracts via `SolidityCheckedContract` and `VyperCheckedContract`
- contract validation methods for creating `SolidityCheckedContract`s
  - an abstraction for a contract ready to be compiled and verified: fetching and assembling its source files, compiling etc.
- Sourcify types and interfaces

## Compiler Setup

The `lib-sourcify` library does not come with compilers as dependencies. Instead, you need to provide a class that implements either the `ISolidityCompiler` or `IVyperCompiler` interface and pass it to any function that requires a compiler.

### Solidity Compiler Example

```typescript
// The external Solidity Compiler
import solidityCompiler from "./compiler/solidityCompiler";

// Include also SolidityOutput and JsonInput as dependencies of ISolidityCompiler
import {
  ISolidityCompiler,
  SolidityOutput,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";

// The custom class implementing ISolidityCompiler
class Solc implements ISolidityCompiler {
  async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false
  ): Promise<SolidityOutput> {
    return await solidityCompiler.compile(version, solcJsonInput, forceEmscripten);
  }
}
const solc = new Solc()

// Pass the class to the functions that needs it
const checkedContract = new SolidityCheckedContract(
  solc,
  {/** metadata */},
  {/** solidity files */},
)
```

### Vyper Compiler Example

```typescript
import vyperCompiler from "./compiler/vyperCompiler";

import {
  IVyperCompiler,
  VyperOutput,
  VyperJsonInput,
} from "@ethereum-sourcify/lib-sourcify";

class Vyper implements IVyperCompiler {
  async compile(
    version: string,
    vyperJsonInput: VyperJsonInput
  ): Promise<VyperOutput> {
    return await vyperCompiler.compile(version, vyperJsonInput);
  }
}
const vyper = new Vyper()

// Pass the class to create a VyperCheckedContract
const checkedContract = new VyperCheckedContract(
  vyper,
  "0.3.7", // vyper version
  "contract.vy", // contract path
  "MyContract", // contract name
  {/** vyper settings */},
  {/** vyper source files */}
)
```

## Validation

Note: Vyper contracts do not support validation through metadata files since they do not include a metadata JSON field in their bytecode. Instead, Vyper contracts must be verified directly using their source files and compiler settings.

The initial step to verify a contract is validation, i.e. creating a `SolidityCheckedContract`. This can be done with `checkFilesWithMetadata` which takes files in `PathBuffer` as input and outputs a `SolidityCheckedContract` array:

```ts
const pathBuffers: PathBuffer[] = [];
pathBuffers.push({
  path: filePath,
  buffer: fs.readFileSync(filePath),
});
```

For a `SolidityCheckedContract` to be valid i.e. compilable, you need to provide a [contract metadata JSON](https://docs.soliditylang.org/en/latest/metadata.html) file identifying the contract and the source files of the contract listed under the `sources` field of the metadata.

```ts
const checkedContracts: SolidityCheckedContract[] = await checkFilesWithMetadata(solc, pathBuffers);
```

Each contract source either has a `content` field containing the Solidity code as a string, or urls to fetch the sources from (Github, IPFS, Swarm etc.). If the contract sources are available, you can fetch them with.

```ts
SolidityCheckedContract.fetchMissing(checkedContracts[0]); // static method
```

By default, IPFS resources will be fetched via https://ipfs.io/ipfs. You can specify a custom IPFS gateway using `process.env.IPFS_GATEWAY=https://custom-gateway`, if you need to pass additional headers to the request (e.g. for authentication) you can use `process.env.IPFS_GATEWAY_HEADERS={ 'custom-header': 'value' }`.

You can check if a contract is ready to be compiled with:

```ts
SolidityCheckedContract.isValid(checkedContracts[0]); // true
```

## Verification

A contract verification essentially requires a `AbstractCheckedContract` and an on-chain contract to compare against the `AbstractCheckedContract`. The library supports both Solidity (`SolidityCheckedContract`) and Vyper (`VyperCheckedContract`) contracts.

### Deployed Contract

You can verify a deployed contract with:

```ts
export async function verifyDeployed(
  checkedContract: AbstractCheckedContract, // Can be SolidityCheckedContract or VyperCheckedContract
  sourcifyChain: SourcifyChain,
  address: string,
  creatorTxHash?: string,
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
  checkedContract: SolidityCheckedContract,
  deployerAddress: string,
  salt: string,
  create2Address: string,
  abiEncodedConstructorArguments?: string,
): Promise<Match>;
```

Example:

```ts
const match = await verifyCreate2(
  checkedContract[0],
  deployerAddress,
  salt,
  create2Address,
  abiEncodedConstructorArguments,
);

console.log(match.chainId); // '0'. create2 matches return 0 as chainId
console.log(match.status); // 'perfect'
```

## Logging

`lib-sourcify` has a basic logging system

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
