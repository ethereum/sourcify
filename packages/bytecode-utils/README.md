# bytecode-utils

Decode the [CBOR encoded data](https://docs.soliditylang.org/en/latest/metadata.html#encoding-of-the-metadata-hash-in-the-bytecode) at the end of an Ethereum contract's bytecode.

## Install

```
yarn add @ethereum-sourcify/bytecode-utils
```

## Usage

```ts
decode(bytecodeRaw);
```

### Result

```json
{
  "cbor": {
    "bytes": "0xa2646970667358221220dceca8706b29e917dacf25fceef95acac8d90d765ac926663ce4096195952b6164736f6c634300060b",
    "length": 51
  },
  "ipfs": "QmdD3hpMj6mEFVy9DP4QqjHaoeYbhKsYvApX1YZNfjTVWp",
  "solcVersion": "0.6.11"
}
```
