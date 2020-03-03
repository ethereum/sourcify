# source-verify

Source-Verify is a service that verifies Ethereum bytecode was compiled from a certain
Solidity source code and maintains a public repository of contract metadata.

The repository indexes metadata with IPFS or Swarm hashes which the solc compiler
embeds in contract bytecode. By fetching code on chain and extracting this hash,
you can obtain related metadata from Source-Verify's records.

More information can be found in Solidity [metadata documentation][30]

[30]: https://solidity.readthedocs.io/en/latest/metadata.html#contract-metadata

## Install
```
$ npm install
$ git submodule update --init
```

## Service

The service has three components:
+ a "monitor" which watches public Ethereum networks for contract deployments
and tries to associate them with sources and metadata published to Swarm or IPFS. It currently
watches:
  + mainnet
  + ropsten
  + rinkeby
  + kovan
  + goerli

+ a website which allows you to submit sources and metadata for a specific contract address
  + https://verification.komputing.org/ (Stable)
  + https://verificationstaging.komputing.org/ (Unstable)

+ a public metadata repository that contains uploaded (or discovered) metadata and their sources:
  + https://contractrepo.komputing.org/ (Stable)
  + https://contractrepostaging.komputing.org/ (Unstable)

**Getting metadata**

Using solc directly on the commandline:

```
solc --metadata --metadata-literal <mySource.sol>
```

or with JSON/IO

```
{
  "settings": {
    "metadata": { "useLiteralContent": true }
  }
}
```

**Using the monitor**

If your Solidity code compiles with solc >= 0.6.0, you just need to upload your
contract metadata and sources to IPFS as part of your deployment process. The monitor service will
automatically add your files to the metadata repository when it sees your contract created on the
network.

A simple example for Truffle projects can be found at [cgewecke/metacoin-source-verify][40]
which contains [a script][41] to publish to IPFS directly from a Truffle compilation artifact.


[40]: https://github.com/cgewecke/metacoin-source-verify
[41]: https://github.com/cgewecke/metacoin-source-verify/blob/master/scripts/ipfs.js

## Security Precautions

Please note that source code verification is only reliable if it is performed
on the **creation** bytecode, i.e. the bytecode payload used when the contract
was created. The deployed bytecode, i.e. the bytecode stored in the blockchain
as code is not sufficient, because the constructor can still be different and
set arbitrary storage entries.

Furthermore, if the constructor requires parameters, these have to be checked
as well.

Also note that there can still be differences in the source code that are not
visible in the bytecode. Variables can be renamed or unused code can be
introduced. Since the bytecode contains a hash of the source code, such
modifications have to be prepared at deploy time, but it is still a possibility.

## Future Plans

- cope with metadata that does not have in-place source code
- automatically retrieve the metadata and the source code from SWARM or IPFS,
  so you only need to supply the metadata hash or bytecode
- perform source verification given only an address instead of the bytecode
  or the metadata


## Run inside docker
### Prerequisites
Docker (https://docs.docker.com/docker-for-mac/install/)
Docker-compose (https://docs.docker.com/compose/install/)

### How to run

If you want to build images locally run:
`docker-compose -f docker-compose.yaml build --no-cache --parallel`

If you change something in files just run:
`docker-compose build --no-cache --parallel && docker-compose up -d` (-d flag means that output
won't be printed in stdout)

## Development

**Launch**

```
docker-compose -f docker-compose-testing.yaml up --build
```

This will build the project in docker containers, launching the monitor and server.
Verified sources and contract addresses will be stored in `repository` and `db` folders
in your project root. The directories are created automatically if they don't exist.

`/ui/dist/index.html` will be served to **http://localhost:1234**

**UI**

To help with manual UI testing, some contracts whose sources and metadata can be found in the
`test/sources/all` folder are automatically deployed to a local ganache instance running
on port 8545. Their contract addresses are deterministically generated at:

| Contracts  |  Addresses |
| ---------  |  --------- |
| Simple.sol |  0x8168f192F7432C93FCb16e039B57FB890AaB3230 |
| SimpleWithImport.sol | 0x0Ef7de872C7110d6020fa5e62d7cD31Fd90FF811 |


Similar sources are also pre-deployed to **Ropsten** and can be found in the `test/sources/ropsten` folder:

| Contracts  |  Addresses |
| ---------  |  --------- |
| Simple.sol |  0xEB6Cf7952c666F81f1a5678E80D4fC5Ce3a7bF0b |
| SimpleWithImport.sol | 0x4668b709182F41837c4e06C8de1D3568df7778D9 |

**Shutdown**
Stop the docker run with ctrl-c

### Tests

Run tests with:

```
npm test
```

`test/sources` contains contracts, compilation artifacts and metadata files which can be used for
building test cases.

- **contracts/**: Solidity files (browser tests)
- **metadata/**: raw metadata files (browser tests)
- **pass/**: compilation artifacts which should verify (unit tests)
- **fail/**: compilation artifacts which should not verify (unit tests)
- **compiler.json**: compiler config for generating more cases

Test sources are compiled with 0x's [sol-compiler][22]. This lets you pick any compiler version or
settings by modifying the `compiler.json` file as needed.

To generate more test data, go to the `test/sources` directory, add Solidity files to the
`contracts` folder and run:

```
npx sol-compiler
```

Compilation artifacts will be written to an `artifacts` folder.

[22]: https://sol-compiler.com/
