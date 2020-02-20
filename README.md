# source-verify

JavaScript / node.js tool that can be used to verify that Ethereum bytecode was
compiled from a certain Solidity source code.

This tool uses the metadata that is embedded in every Solidity contract bytecode
to automatically retrieve the compiler versiond and all settings used, so at best,
you only need to specify the metadata and nothing else.

## Install
```
$ npm install
$ git submodule update --init
```

## Usage

Until we have a reliable way to retrieve files based on their hash (see
"Future Plans" below),
you need to supply both the matadata and the source code. The Solidity
compiler has an option to include the source code in the metadata directly
and only this mode is currently supported (see "Future Plans" below).
You can achieve this by compiling using

```
solc --metadata --metadata-literal
```

on the commandline or via

```
{
  "settings": {
    "metadata": { "useLiteralContent": true }
  }
}
```

in standard-json-io.

Once you have that metadata in e.g. the file called `"meta.json"` you run

```
./index.js < meta.json
```

The script will download the correct Solidity compiler binary, compile the
contract and output the resulting bytecode and metadata json. The only
step you still have to do is comparing the bytecode with the craetion
bytecode of the contract in the blockchain.

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
Prepare environment and start by running
`STAGE=prod ./prepare_and_start.sh` for production
`STAGE=testing ./prepare_and_start.sh` for testing.

If you want to build images locally run:
`docker-compose -f docker-compose.yaml build --no-cache --parallel`

If you change something in files just run:
`docker-compose build --no-cache --parallel && docker-compose up -d` (-d flag means that output won't be printed in stdout)

## Development

### Launch service

```
docker-compose -f docker-compose-testing.yaml up --build
```

This will build the project in docker containers, launching the monitor and server.
Verified sources and contract addresses will be stored in `repository` and `db` folders
in your project root. The directories are created automatically if they don't exist.

`/ui/dist/index.html` will be served to `http://localhost:1234`

Stop the docker run with ctrl-c

### Tests

Run tests with:

```
npm test
```

`test/sources` contains contracts, compilation artifacts and metadata files which can be used for building test cases.

- **contracts/**: Solidity files (browser tests)
- **metadata/**: raw metadata files (browser tests)
- **pass/**: compilation artifacts which should verify (unit tests)
- **fail/**: compilation artifacts which should not verify (unit tests)
- **compiler.json**: compiler config for generating more cases

Sources are compiled with 0x's [sol-compiler][22]. This lets you pick any compiler version or settings by modifying the `compiler.json` file as needed.

To generate more test data, go to the `test/sources` directory, add Solidity files to the `contracts` folder and run:

```
npx sol-compiler
```

Compilation artifacts will be written to an `artifacts` folder.

[22]: https://sol-compiler.com/
