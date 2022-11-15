# bytecode-utils

Decode the [CBOR encoded data](https://docs.soliditylang.org/en/latest/metadata.html#encoding-of-the-metadata-hash-in-the-bytecode) at the end of an Ethereum contract's bytecode.

## Install

```
yarn add @ethereum-sourcify/bytecode-utils
```

## Usage

```ts
import { decode } from "@ethereum-sourcify/bytecode-utils";

const bytecodeRaw = "0x60806040526004361061003f5760003560e01...7265206c656e677468a2646970667358221220dceca8706b29e917dacf25fceef95acac8d90d765ac926663ce4096195952b6164736f6c634300060b0033"

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
  "experimental": true
}
```
