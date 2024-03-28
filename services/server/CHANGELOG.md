# Changelog for `sourcify-server`

All notable changes to this project will be documented in this file.

## sourcify-server@1.5.4 - 2024-03-28

- Improved logging:
  - Log nicely formatted line logs in development and JSON logs in production
  - Added `NODE_LOG_LEVEL` env variable
  - Enable dynamic log level chaning through an authenticaed endpoint `/change-log-level`. The auth token is set at `SETLOGGING_TOKEN`
- Fix path sanitization not sanitizing new lines `\n`.
- Updating verified contract in the DB. Previously it was just inserting.
- Add tests for Database
- New chains:
  - Fraxtal (252)
  - Fraxtal Testnet (2522)
  - Phoenix Mainnet (13381)

## sourcify-server@1.5.3 - 2024-03-15

- New chains:
  - Endurance Smart Chain Mainnet (648)
  - CrossFi Chain Testnet (4157)
  - Tiltyard Mainnet (710420)
- Deprecated chains:
  - Base Goerli Testnet (84531)

## sourcify-server@1.5.2 - 2024-03-14

- Update address for chain 534352 with standard-json
- Fix repository key name in local-test.js
- Update test contract address for Arthera Testnet
- Increase session api tests timeout
- Fix library transformation, use bytea instead of string for bytea
- Bug/fixed issue 1271 files stored with incorrect runtime match
- Implement verifier alliance tests
- Oasis chains: Use new fetchContractCreationTxUsing URLs
- Fix tests after new extra-file-input-bug responses
- Fix #1288 add unexpected field validation
- Fix wrong runtimeMatch check after creation match
- #1293 insert sync row in sourcify_sync for each match until sync ends
- Fix Telos chain name in tests
- Turn off chains: 78430, 78431, 78432
- Add Ozone Chain Mainnet (#1292)
- Update migration script
- Add repositoryV2 in master config
- Remove goerli e2e tests
- New chains:
  - Ozone Chain Mainnet

## sourcify-server@1.5.1 - 2024-02-26

- Allow passing Etherscan API key as parameter in import from Etherscon
- Hot fix checkAllByChainAndAddress was calling checkByChainAndAddress

## sourcify-server@1.5.0 - 2024-02-22

- Readies the server for the new database based architechture (but does not write yet because the env's are not set as of deployment.)
  - Currently Sourcify is based on a filesystem. This release prepares the server to be able to use a database instead of the filesystem. DB gives us more flexibility and other things like querying, scalability, and lets us support other languages because the filesystem assumes metadata.json
  - The database is based on the Verifier Alliance database schema, plus an additional DB for sourcify needed information
  - We'll write to the DB and FS simulatanously for a while. Still, the FS is the source of truth until full migration.
  - Scripts available to migrate the DB.
  - repository (filesystem) is now repositoryV1. We keep it for backwards compatibility but we'll remove it soon.
  - We'll have repository V2 will be here long term and will replace V1. The main purpose is to serve files on IPFS. Here we normalize the file names with their hashes which should solve the name problems [#515](https://github.com/ethereum/sourcify/issues/515).
- Replace the keccak256 identifier generation in the session with a lightweight hash (node crypto's sha1)
- New chains:
  - ZetaChain Mainnet (7000)
  - Lyra Mainnet (957)
  - Arthera Mainnet (10242)
  - Polygon zkEVM (1101)
  - Scroll (534352)
  - Scroll Sepolia Testnet (534351)
  - Mode (34443)
  - Mode Testnet (919)
  - Conflux eSpace (1030)
  - ZKFair Mainnet (42766)
  - Ligtlink Phoenix Mainnet (1890)
  - Lightlink Pegasus Testnet (1891)
  - Kroma (255)
  - Kroma Sepolia (2358)
- Deprecated chains:
  - Gather Testnet (356256156)

## sourcify-server@1.4.4 - 2024-01-04

- Fix staging `rateLimit` config that is missing

## sourcify-server@1.4.3 - 2024-01-03

- Increase "master" rate limit to 2 req/sec
- Add rate limit to the config file
- Add `local-test.js` config file for tests. Pass `NODE_CONFIG_ENV=test` to use it.
- Improved logging
- Point dotenv to the correct file
- Pass direcory to `verifyContract` function in `chain-tests.js` instead of each file.
- Add missing files in few chain tests to avoid IPFS fetching.
- Deprecated chains:
  - Klaytn Mainnet Cypress (8217)
  - Taiko Grimsvotn L2" (167005)
  - Taiko Eldfell L3 (167006)
  - Kekchain Main Net (kekistan) (420420)
  - Kekchain Test Net (kektest) (420666)
- Updated Evmos `blockscoutScrape` URL

## sourcify-server@1.4.2 - 2023-12-19

- Revert hotfix in 1.4.1

## sourcify-server@1.4.1 - 2023-12-19

- Fix already partially verified contracts being verified again instead of retuning the existing verification.

## sourcify-server@1.4.0 - 2023-12-19

- Remove `CREATE2` verification and related code as it is not used and makes the code unnecessarily complex with `AUTH0` etc.
- Clean-up environment variables and enable passing configs in a .js file. https://github.com/ethereum/sourcify/pull/1232. Use config instead of env vars.
- Enable passing `sourcify-chains.json` as a file instead of a built-in `sourcify-chains.ts` https://github.com/ethereum/sourcify/pull/1223
- Change the `RepositoryService` to `IpfsRepositoryService`. Create an umbrella `StorageService` to handle all storage related operations. Also a `AllianceDatabase` service under the `StorageService` which is currently not used (turned off).
- Use multi-stage Docker builds and use bullseye-slim
- Bring whitelists for rate limiting
- Improved logging, remove `SourcifyEventManager`.
- Update README for passing `sourcify-chains.json` and the server configs (`default.js` etc) file and how to run the Docker containers
- Remove Typescript from dependencies and move to the project root
- Remove snowtrace.io from Etherscan support
- New Chains:
  - Arbitrum Sepolia (421614)
  - Optimism Sepolia (11155420)
  - Stratos Mainnet (2048)
  - Stratos Testnet (2047)
  - Energi Testnet (49797)
  - Energi Mainnet (39797)
  - Mantle Mainnet (5000)
  - Crosbell Mainnet (3737)
  - Rikeza Network (1433)
  - Zeniq Mainnet (383414847825)
  - Tiltyard Subnet (1127469)
- Deprecated Chains:
  - Arbitrum Goerli (421613)
  - Optimism Goerli (420)

## sourcify-server@1.3.1 - 2023-11-23

- Add AWS_LAMBDA_FUNCTION to specify the name of the lambda function

## sourcify-server@1.3.0 - 2023-11-23

- Use compiler as a lambda function
- Custom compiler using SOLIDITY_COMPILER env variable: `local`, `lambda`
- Run tests in parallel
- New chains:
  - Coredao testnet chain (1115)
  - Rootstock (30)
  - Zora Sepolia Testnet (999999999)

## sourcify-server@1.2.0 - 2023-11-03

- Add support for the Verifier Alliance (disabled)
- Move server under ./services in the monorepo
- Refactor contract creation transaction fetcher
- Minor fixes

## sourcify-server@1.1.2 - 2023-10-19

- Add a filter to prevent the same contract to be verified simultaneously

## sourcify-server@1.1.1 - 2023-10-09

- Remove monitor code from the server directory `src/`
- Update chains.json
- Renaming `ALCHEMY_ID` and `INFURA_ID` to `..._API_KEY`
- Remove the `monitored` field from `sourcify-chains.ts`
- New chains:
  - Ethereum Holesky Testnet (17000)
  - PulseChain Mainnet (369)
  - Mind Smart Chain Mainnet (9996)
  - Mind Smart Chain Testnet (9977)
  - Shrapnel Testnet (2038)
  - Shrapnel Subnet (2044)
  - Arthera Testnet (10243)
  - Core Blockchain Mainnet (1116)
  - Q Mainnet (35441)
  - Q Testnet (35443)

## sourcify-server@1.1.0 - 2023-09-04

- Updated lerna to `7.1.5`
- #1158 Add `REPOSITORY_URL_HOST` env variable to `sourcify-server` to allow for custom repository paths in containers. Previously this was hardcoded as `../../data/repository`
- Updates chains.json
- New chains:
  - Kiwi Subnet (2037)
  - Beam Subnet (4337)
  - Amplify Subnet (78430)
  - Bulletin Subnet (78431)
  - Conduit Subnet (78432)

## Older releases

Previously, the releases were not done one separate modules of Sourcify but for the repository as a whole.
You can find the changelog for those releases in [older releases](https://github.com/ethereum/sourcify/releases) for this repository.
