# contract-call-decoder

Returns an object containing the evaluated information from the called contract's metadata. See the [NatSpec documentaion](https://docs.soliditylang.org/en/latest/natspec-format.html) for more details.

```json
{
  "contract": {
    "author": "...",
    "title": "A simulator for trees",
    "details": "All function calls are currently implemented without side effects",
    "custom": {}
  },
  "method": {
    "selector": "multiplyBy(uint256)",
    "abi": {...},
    "details": "...",
    "params: { _n2": "..." },
    "returns": "",
    "notice": "Set the new value to 4",
    "decodedParams": [ 2 ],
    "custom": {}
  }
}
```

> Right now the contract-call-decoder uses `@blossom-labs/rosette-radspec` to interpret the notice, but it's experimental. This feature might change in the future.

## Install

```
yarn add @ethereum-sourcify/contract-call-decoder
```

## Usage

First import the library and have a transaction (ethers and web3 transaction artifacts are compatible)

```ts
import { evaluateCallDataFromTx } from '@ethereum-sourcify/contract-call-decoder';

const tx = {
  to: '0xD4B081C226Bc8aBdaf111DEf54c09E779ad29428',
  data: '0xcea299370000000000000000000000000000000000000000000000000000000000000002',
};
```

### Using metadata taken from Sourcify

```ts
const decodedContractCall: DecodedContractCall = await evaluateCallDataFromTx(
  tx,
  { chainId: 5 }
);
```

### Using the metadata IPFS hash from the contract's on-chain bytecode

```ts
const decodedContractCall: DecodedContractCall = await evaluateCallDataFromTx(
  tx,
  {
    source: MetadataSources.BytecodeMetadata,
    rpcProvider: ethereumProvider,
  }
);
```

### Response evaluateCallDataFromTx

```ts
type DecodedContractCall = {
  readonly contract: {
    readonly author?: string;
    readonly title?: string;
    readonly details?: string;
    readonly custom?: {
      readonly [index: string]: string;
    };
  };
  readonly method: {
    readonly selector: string;
    readonly abi: FunctionFragment;
    readonly decodedParams: readonly DecodedParam[];
    readonly details?: string;
    readonly returns?: string;
    readonly notice?: string;
    readonly params?: { readonly [index: string]: unknown };
    readonly custom?: {
      readonly [index: string]: string;
    };
  };
};
```

### evaluateCallDataFromTx options

```ts
type GetMetadataOptions = {
  readonly source?: MetadataSources;
  readonly chainId?: number;
  readonly address?: string;
  readonly rpcProvider?: EthereumProvider;
  readonly ipfsGateway?: string;
  readonly sourcifyProvider?: string;
};
```
