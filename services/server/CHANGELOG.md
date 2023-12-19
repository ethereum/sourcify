# Changelog for `sourcify-server`

All notable changes to this project will be documented in this file.

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
