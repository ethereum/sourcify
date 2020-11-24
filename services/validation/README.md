# Sourcify Validation 🧑‍💻📝🔍 

The Sourcify Validation script helps you re-compile and source-verify your Solidity smart contracts.

If Solidity source files are spread across multiple files, re-compiling them is often complicated.
To help with re-compilation, [the Solidity compiler](https://solidity.readthedocs.io/en/latest/installing-solidity.html) generates a file called "metadata.json" that
contains all settings, filenames and file hashes required to re-compile the contract into the exact same binary.

Several tools, including [Truffle](https://www.trufflesuite.com/) and [Buidler](https://buidler.dev) store this file with each compilation.

## Usage as a script

* `npm install -g @ethereum-sourcify/validation`
* `sourcify-validation my/repository`

You can specify a sequence of files, directories and even zip files.
The script will scan through all the provided files, searching for metadata and the belonging source files.

If everything goes well, you can ask it to provide a "standard-json input file"
that you just need to send to the compiler, etherscan, or whatever service you use
for verification.

Verification is also achievable through the use of [Sourcify](https://sourcify.dev/). All you need to do is upload the files
you had provided to this script.

## Options
* -j, --prepare-json <path:name>
  * Output only a JSON object to be used as standard-json input to solc.
  * The expected argument ought to be of the form path:name
  * E.g. `sourcify-validation --prepare-json foo/bar/Contract.sol:ContractName path/to/dir`
  * Omitting either the path or the name is tolerated if unambiguous.
* -S, --no-settings
  * Omit the original settings when preparing a standard-json.
  * Only available with the --prepare-json option.
* -p, --pretty
  * Output the standard json in a pretty format.
  * Only available with the --prepare-json option.
* -h, --help
  * Output the help message.
* -v, --version
  * Output the current version.

## Example - Piping the standard-json input to the Solidity compiler
Consider the case of a metadata.json file specifying a single source file (1_Storage.sol), both located inside the current directory.

The file `metadata.json` is the essential part: it contains the compilation parameters. During compilation, you get it using `solc --metadata ...`

Since Sourcify Validation will only consider the relevant files, you can run the command as:
### Command
* `sourcify-validation .`

### Output
```
Storage (browser/1_Storage.sol):
  Success!
  Compiled with Solidity 0.6.6
  https://solc-bin.ethereum.org/wasm/soljson-v0.6.6+commit.6c089d02.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.6.6+commit.6c089d02
  To recompile, use: `sourcify-validation --prepare-json browser/1_Storage.sol:Storage /path/to/dir | solc --standard-json`
```

If you don't have the required version of the compiler, run:
* `wget https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.6.6+commit.6c089d02 -O solc-0.6.6`

Then run:
* `sourcify-validation -j browser/1_storage.sol:Storage . | solc-0.6.6 --standard-json`

If you use `jq`, the output will have a nice format:
* `sourcify-validation -j browser/1_storage.sol:Storage . | solc-0.6.6 --standard-json | jq`

This yields a JSON output containing the ABI and bytecode of the compiled contract (some values were truncated for readability):
```json
{
  "contracts": {
    "browser/1_Storage.sol": {
      "Storage": {
        "abi": [
          {
            "inputs": [],
            "name": "retreive",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "num",
                "type": "uint256"
              }
            ],
            "name": "store",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        "evm": {
          "bytecode": {
            "linkReferences": {},
            "object": "6080604052348015610010576000...f6c63430006060033",
            "opcodes": "PUSH1 0x80 ... CALLER ",
            "sourceMap": "105:...;;"
          }
        }
      }
    }
  },
  "sources": {
    "browser/1_Storage.sol": {
      "id": 0
    }
  }
}
```

## Example - Multiple sources
### Command
`sourcify-validation Escrow.sol Main.sol Owned.sol provableAPI_0.6.sol Savings.sol metadata.json`

### Output
```
Savings (browser/Savings.sol):
  Success!
  Compiled with Solidity 0.6.11
  https://solc-bin.ethereum.org/wasm/soljson-v0.6.11+commit.5ef660b1.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.6.11+commit.5ef660b1
  To re-compile use: `sourcify-validation --prepare-json browser/Savings.sol:Savings Escrow.sol Main.sol Owned.sol provableAPI_0.6.sol Savings.sol metadata.json | solc --standard-json`
```

## Example - Multiple sources; some are missing
### Command
`sourcify-validation Owned.sol provableAPI_0.6.sol Savings.sol metadata.json`

### Output
```
Savings (browser/Savings.sol):
  Error: Missing sources:
  The following files were not provided (or were altered, so their hash doesn't match the one in the metadata).
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
The following commands yield effectively the same output:
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
  sourcify-validation --prepare-json /home/user/truffle-example/contracts/ConvertLib.sol:ConvertLib test/files/truffle-example.zip | solc --standard-json

MetaCoin (/home/user/dir/truffle-example/contracts/MetaCoin.sol):
  Success!
  Compiled with Solidity 0.5.16
  https://solc-bin.ethereum.org/wasm/soljson-v0.5.16+commit.9c3226ce.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.5.16+commit.9c3226ce
  sourcify-validation --prepare-json /home/user/truffle-example/contracts/MetaCoin.sol:MetaCoin test/files/truffle-example.zip | solc --standard-json`

Migrations (/home/user/dir/truffle-example/contracts/Migrations.sol):
  Success!
  Compiled with Solidity 0.5.16
  https://solc-bin.ethereum.org/wasm/soljson-v0.5.16+commit.9c3226ce.js
  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v0.5.16+commit.9c3226ce
  sourcify-validation --prepare-json /home/user/truffle-example/contracts/Migrations.sol:Migrations test/files/truffle-example.zip | solc --standard-json

```

## Usage as a module
* `npm install @ethereum-sourcify/validation`
#### Process paths
```typescript
import { ValidationService } from '@ethereum-sourcify/validation';

const validationService = new ValidationService();
const paths = ["path/to/file1", "path/to/file2"];

// This is where the validation magic happens.
const checkedContracts = validationService.checkPaths(paths);

function work(files) {
  for (const file in files) {
    console.log("\t" + files[file]);
  }
}

checkedContracts.forEach(contract => {
  if (contract.isValid()) {
    console.log(`Contract ${contract.name} is valid!`);
  } else {
    console.log(`Contract ${contract.name} is not valid!`);

    console.log("Found sources:");
    work(contract.solidity);

    console.log("Missing sources:");
    work(contract.missing);

    console.log("Invalid sources:");
    work(contract.invalid);
  }
});

// To get the same json that solc uses as --standard-json input, use .getStandardJson()
const firstContract = checkedContract[0];
console.log(firstContract.getStandardJson());

```
#### Process buffers
```typescript
import express from 'express';
import { ValidationService, PathBuffer } from '@ethereum-sourcify/validation';

const app = express();
const validationService = new ValidationService();

app.post("/", (req, res) => {
    const uploadedFiles = [].concat(req.files.files);
    const files = uploadedFiles.map(f => ({ buffer: f.data }));
    const checkedContracts = validationService.checkFiles(files);
    const allValid = checkedContracts.every(contract => contract.isValid());
    if (allValid) {
      res.send("Ready for verification!");
    } else {
      res.status(400).send("Check yoself before you wreck yoself!");
    }
});
```