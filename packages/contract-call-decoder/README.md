# contract-call-decoder

Package to decode Ethereum transactions into human-readable format using the [ABI JSON](https://docs.soliditylang.org/en/latest/abi-spec.html#json) and the [NatSpec](https://docs.soliditylang.org/en/latest/natspec-format.html) documentation, which are both found in the [Solidity contract metadata](https://docs.soliditylang.org/en/develop/metadata.html).

The decoder will also evaluate the [NatSpec Dynamic Expressions](https://docs.soliditylang.org/en/develop/natspec-format.html#dynamic-expressions) meaning it will fill in the values of the parameters found in the call. So for the function:

```solidity
/// @dev Has to be called by the owner. The _index value `_index` can't be larger than the people array length.
function chooseFavoritePerson(uint256 _index) public returns (Person memory, uint) {
```

the decoding of `chooseFavoritePerson(1)` call will be:

```
Has to be called by the owner. The _index value 1 can't be larger than the people array length.
```

## Install

```
yarn add @ethereum-sourcify/contract-call-decoder
```

## Usage

Example below given for the `chooseFavoritePerson(3)` method of the contract `SimpleStorageNatSpec` (verified at Sepolia [0x09aFa1879fa654226D522f7099583d54ee8F18f4](https://repo.sourcify.dev/contracts/full_match/11155111/0x09aFa1879fa654226D522f7099583d54ee8F18f4/))

```ts
import {
  decodeContractCall,
  MetadataSources,
} from '@ethereum-sourcify/contract-call-decoder';

// ethers and web3 transactions are compatible
const tx = {
  to: '0x09aFa1879fa654226D522f7099583d54ee8F18f4',
  data: '0xae7cd3ce0000000000000000000000000000000000000000000000000000000000000001', // chooseFavoritePerson(3)
};

// Using metadata fetched from Sourcify API https://repo.sourcify.dev...
let decodedObj: DecodedContractCall;

// async function
decodedObj = await decodeContractCall(tx, { chainId: 11155111 });

import provider from 'eth-provider';

// Using metadata fetched from the embeded IPFS hash inside contract's bytecode
decodedObj = await decodeContractCall(tx, {
  source: MetadataSources.BytecodeMetadata,
  rpcProvider: provider('https://rpc.sepolia.dev');, // RPC Provider to fetch the contract bytecode
});
```

Returned `DecodedContractCall` is slightly different than the `userdoc` and `devdoc` output in the metadata
and grouped under "contract" and the "method" being called.

```js
// Output:
{
  "contract": {
    // @author field above the contract
    "author": "John Doe",
    // @title field above the contract
    "title": "A simple example contract to demonstrate NatSpec",
    // @dev field above the contract
    "details": "This message is intended for contract developers. Add technical details etc. here",
    // @custom:experimental
    "custom": {
      "experimental": "This is an experimental tag."
    }
  },
  "method": {
    // Required, Canonical function selector string
    "selector": "chooseFavoritePerson(uint256)",
    // Required
    "abi": {...},
    // @dev field above the function
    "details": "Has to be called by the owner. The _index value 1 can't be larger than the people array length.",
    // @param fields
    "params": {
      "_index": "The index of the favorite person"
    },
    // @return fields
    "returns": {
      "_0": "Newly chosen favorite Person",
      "_1": "The index of the new favorite Person",
    },
    // @notice field
    "notice": "Chooses the person at index 1 as the favorite person",
    // TODO: This output is incorrect?
    // Required
    "decodedParams": [
      1n,
    ],
    // @custom:status
    "custom": {
      "status": "production-ready"
    }
  }
}
```

Right now the contract-call-decoder uses `@blossom-labs/rosette-radspec` to interpret the notice, but it's experimental. This feature might change in the future.
