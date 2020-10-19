# Sourcify Script 🧑‍💻📝🔍 

The Sourcify Validation script helps you re-compile and source-verify your Solidity smart contracts.

If Solidity source files are spread across multiple files, re-compiling them is often complicated.
To help with re-compilation, the Solidity compiler generates a file called "metadata.json" that
contains all settings, filenames and file hashes required to re-compile the contract into the exact
same binary.

Several tools, including truffle and buidler store this file with each compilation.

##### How to?

Just point Sourcify Validation at your source folder that includes the build directory,
and it will tell you how to re-compile each of your contracts:

* `npm install -g sourcify-validation`
* `sourcify-validation my/repository`

You can specify a directories, a sequence of files and even zip files.
The script will scan through all the provided files, search for metadata and the belonging source files.

If everything goes well, you can ask it to provide a "standard-json input file"
that you just need to send to the compiler, to etherscan, or whatever service you use
for verification.

If you use sourcify, this step is done for you. All you need to do is upload the files
you provided to Sourcify-Validation.


## Example - multiple sources
### Command
`sourcify-validation Escrow.sol Main.sol Owned.sol provableAPI_0.6.sol Savings.sol metadata.json`

The file ``metadata.json`` is the essential part: It contains the compilation parameters.
During compilation, you get it using ``solc --metadata ...``.

Since Sourcify Validation will only consider the relevant files, you can also just run it as
`sourcify-validation .`.


### Output
```
Savings (browser/Savings.sol):
  Success!
  Compiled with Solidity 0.6.11
  https://solc-bin.ethereum.org/wasm/soljson-v0.6.11+commit.5ef660b1.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.6.11+commit.5ef660b1
```

As a next step, download the Solidity copmiler of the right versionyou can request the standard-json input for the compiler
for a specific contract and pipe it through the Solidity compiler of the right version:

`sourcify-validation -j browser/Savings.sol:Savings . | solc-linux-amd64-v0.6.11+commit.5ef660b1 --standard-json - > output.json`.

If you use `jq`, it will nicely format it:

### Output
```
sourcify-validation -j browser/Savings.sol:Savings . | solc-linux-amd64-v0.6.11+commit.5ef660b1 --standard-json - | jq
{
  ...
}
```


## Example - multiple sources; some are missing
### Command
`sourcify-validation Owned.sol provableAPI_0.6.sol Savings.sol metadata.json`

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
    `sourcify-validation truffle-example/`
2. paths to subdirectories  
    `sourcify-validation truffle-example/contracts/ truffle-example/build/`
3. path to zipped directory  
    `sourcify-validation truffle-example.zip`

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