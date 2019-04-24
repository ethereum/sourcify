# source-verify

JavaScript / node.js tool that can be used to verify that Ethereum bytecode was
compiled from a certain Solidity source code.

This tool uses the metadata that is embedded in every Solidity contract bytecode
to automatically retrieve the compiler version and all settings used, so at best,
you only need to specify the metadata and nothing else.

## Usage

Until we have a reliable way to retrieve files based on their hash (see
"Future Plans" below),
you need to supply both the matadata and the source code. The Solidity
compiler has an option to include the source code in the metadata directly
and only this mode is currently supported (see "Future Plans" below).
You can achieve this by compiling using

    solc --metadata --metadata-literal

on the commandline or via

    {
		"settings": {
			 "metadata": { "useLiteralContent": true }
		}
	}

in standard-json-io.

Once you have that metadata in e.g. the file called `"meta.json"` you run

    ./index.js < meta.json

The script will download the correct Solidity compiler binary, compile the
contract and output the resulting bytecode and metadata json. The only
step you still have to do is comparing the bytecode with the creation
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
