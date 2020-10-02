# Sourcify Script 🧑‍💻📝🔍 

#### Use this script to verify if your source files are in the correct format for [Sourcify](https://github.com/ethereum/sourcify)

##### How to?

* `npm install`
* `npm start path/to/file1 path/to/file2 path/to/dir path/to/zip`
    * the script will scan through all the provided files, directories and zips searching for metadata and the belonging source files
* If everything goes well, proceed here: [Sourcify](https://verification.komputing.org/)

## Example - multiple sources
### Command
`npm start Escrow.sol Main.sol Owned.sol provableAPI_0.6.sol Savings.sol metadata.json`

### Output
```
Savings (browser/Savings.sol):
  Success!
  Compiled with Solidity 0.6.11
  https://solc-bin.ethereum.org/wasm/soljson-v0.6.11+commit.5ef660b1.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.6.11+commit.5ef660b1
```

## Example - multiple sources; some are missing
### Command
`npm start Owned.sol provableAPI_0.6.sol Savings.sol metadata.json`

### Output
```
Savings (browser/Savings.sol):
  Error: Missing sources:
  The following files were not part in the list of files and directories provided.
  Please retrieve the files (potentially via ipfs) and re-run the script.
    browser/Escrow.sol:
      keccak256: 0x3685704dbcc97358956da378d8250b4e5062a47ee6ed3090f519ebc50a579a11
      bzz-raw://7e46a52b71bebeb845d35d4925fb96a5ef4b9f72f5b95ac407ec833731eafb23
      dweb:/ipfs/QmZ87S4kA9ook24nr8QatoYAaZM12m7DZB6uvM7yMe9SKU
    browser/Main.sol:
      keccak256: 0xf6727a46bdc24bffc5645254531bb6533da6fcdd5fcf726e81a7cb7def57f0a1
      bzz-raw://5449b75552ec776271eb7802eb61ac0f61759a14f75c42732dabee71621b45d0
      dweb:/ipfs/Qmag6X92SQRL9ZkPTtDpPqrsoCvrNj2K9aSJe9BFb9pUyY
  3 other source files found successfully.
```

## Example - Truffle project ([Metacoin example](https://www.trufflesuite.com/docs/truffle/quickstart))

### Command
The following commands yield the same output:
1. path to directory containing the project

    `npm start truffle-example/`
2. paths to subdirectories

    `npm start truffle-example/contracts/ truffle-example/build/`
3. path to zipped directory

    `npm start truffle-example.zip`

### Output
```
ConvertLib (/home/user/dir/truffle-example/contracts/ConvertLib.sol):
  Success!
  Compiled with Solidity 0.5.16
  https://solc-bin.ethereum.org/wasm/soljson-v0.5.16+commit.9c3226ce.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.5.16+commit.9c3226ce

MetaCoin (/home/user/dir/truffle-example/contracts/MetaCoin.sol):
  Success!
  Compiled with Solidity 0.5.16
  https://solc-bin.ethereum.org/wasm/soljson-v0.5.16+commit.9c3226ce.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.5.16+commit.9c3226ce

Migrations (/home/user/dir/truffle-example/contracts/Migrations.sol):
  Success!
  Compiled with Solidity 0.5.16
  https://solc-bin.ethereum.org/wasm/soljson-v0.5.16+commit.9c3226ce.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.5.16+commit.9c3226ce

```