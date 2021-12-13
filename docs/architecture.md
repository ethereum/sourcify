## Services

- Server:
  - Workflow:
    - listens for requests (source and metadata files, addresses, chain IDs)
    - fetches potentially missing source files
    - recompiles what users upload
    - compares the recompiled with on-chain bytecode
    - stores files if the comparison results in a match
    - the match can be a `full` or a `partial` match. [Read here about the difference.](https://blog.soliditylang.org/2020/06/25/sourcify-faq#what-are-full-matches)
  - API described in [the README](https://github.com/ethereum/sourcify#api).
  - There is an additional, session-based API v2, designed to be used by the version of UI (UI-draft).
  - Internal logic described in [Code Logic](#code-logic).
  - Available at (with a POST request):
    - https://sourcify.dev/server (`master`)
    - https://staging.sourcify.dev/server (`staging`)
- Monitor:
  - Workflow ([link](https://medium.com/shard-labs/how-smart-contracts-can-be-automatically-verified-28ee1c5cf941)):
    - RPC nodes are periodically queried for new blocks
    - when a new contract is deployed, its metadata's IPFS hash is extracted from the end of the bytecode
    - the metadata is fetched from IPFS
    - source files information and compiler version are read from the metadata file
    - the source files are fetched and recompiled
    - files are stored to the repo
- UI:
  - provides a user friendly interface for communicating with the server
  - two purposes:
    - check if an address is verified (and return a repo link to sources if so)
    - verify a contract
  - available at:
    - https://sourcify.dev (`master`)
    - https://staging.sourcify.dev (`staging`)
  - a new version of the UI, under development, is known as UI-draft
- IPFS:
  - adds the repository to IPFS
  - periodically - every hour
  - used by the server and Monitor when fetching metadata/source files
- S3:
  - makes a backup of the repository in an S3 bucket
  - periodically - every hour
- Repository:
  - an explorer of source and metadata files of verified contracts
  - `full` and `partial` matches are kept separately
  - available at:
    - https://repo.sourcify.dev (`master`)
    - https://repo.staging.sourcify.dev (`staging`)
  - API and more described in [the README](https://github.com/ethereum/sourcify#repository-api)

## Servers

- Sourcify relies on two servers: _Komputing_ and _Gather_.
- _Komputing_ hosts:
  - the stable versions of [services](#services) (AKA the `master`).
- _Gather_ hosts:
  - the latest versions of [services](#services) (AKA the `staging`).
  - UI-draft:
    - a new, alpha version of the UI, under development, relies on the Server API v2
    - available at https://draft.staging.sourcify.dev
  - Geth forks of Ethereum Mainnet, Rinkeby, Ropsten and Goerli:
    - used by Sourcify as RPC nodes
    - more info in [Other packages](#other-packages)
  - Creation data DB:
    - the creation data, chain and address of each deployed contract are stored into the DB by Geth forks
    - to be used by future versions of Sourcify:
      - after recompiling a contract, its bytecode can be used in a DB query to find its creation bytecode and address
      - this would eliminate the need of users providing address and chain when verifying

## Development Flow

- When developing new features, a new branch is created from the `staging` branch.
- When adding the new feature in a PR, the branch `staging` should be targeted.
- After a successful review, the commits may be squashed and rebased onto `staging`.
- If the new staging environment works well for a few hours/days, or after there have been multiple new features on the `staging` branch, a new version PR is created which targets the `master` branch.
- Following these points is not necessary for Sourcify to work, but is considered good practice.
- However what is necessary is that versions in the `package.json` files be manually bumped, as was done in [this commit](https://github.com/ethereum/sourcify/commit/15814a10bd4b856f5815e2bd032133bdb17f8884).

## Supported Chains and Adding New Ones

- The chains whose contracts can be verified with Sourcify are specified in [`services/core/src/sourcify-chains.ts`](https://github.com/ethereum/sourcify/blob/master/services/core/src/sourcify-chains.ts):
  - Here it is possible to separately enable manual and monitoring support.
- When adding support for a new chain:
  - Check what data is already present in [`services/core/src/chains.json`](https://github.com/ethereum/sourcify/blob/master/services/core/src/chains.json) because that file is read by `sourcify-chains.ts`:
    - `chains.json` is not to be edited manually, but should be updated by downloading a new version from [this page](https://chainid.network/chains.json). The downloaded json file can be sorted by chainId with `jq 'sort_by(.chainId)' chains.json > out.json`
  - Add support in the UI by editing [`ui/src/common/constants.ts`](https://github.com/ethereum/sourcify/blob/master/ui/src/common/constants.ts) and in [the Remix plugin](#other-packages)
- Supporting a chain means, among other things, enabling it to communicate with a synchronized node. For this, chains use:
  - our own RPC nodes hosted on Gather (e.g. Rinkeby)
  - non-restricted nodes (e.g. xDai)
  - restricted nodes (e.g. Polygon/Matic):
    - these require creating and storing a key for node access; Sourcify achieves this through [Alchemy](https://alchemyapi.io/)

## CI/CD

- Specified in `.circleci/config.yml`.
- When a new commit is pushed to `origin`, regardless of the branch, Mocha tests are run.
- Pipeline progress can be tracked in [the dashboard](https://app.circleci.com/pipelines/github/ethereum/sourcify).
- When pushing to `staging` or `master`, the `build-publish-deploy` task is run:
  - Docker images of server, UI, repository and monitor are built and pushed to Docker Hub
  - If all images are built and pushed successfully, deployment is initiated.
  - If deployment is successful, end-to-end (e2e) tests are run:
    - `monitor-e2e-*` deploys a contract, waits and periodically checks if the Monitor service has picked the contract up.
    - `verification-e2-*` deploys a contract, sends it to the server for verification and expects it to be succesfully verified.
  - Note: deployment does not depend on the success of Mocha tests.
- When pushing to `master`, if the Mocha tests are successfully executed, the `npm-publish` task is run, which updates NPM packages if their versions have changed.
- When pushing to `staging`, the ui-draft image is also pushed.
- A `nigthly` workflow is launched every day at 01:00 UTC:
  - it runs the E2E tests for the `master` version of Sourcify
  - it is recommended to check the result of this test every day
- Sometimes CircleCI fails when you expect it to succeed. It might be because:
  - some RPC endpoints are unavailable
  - CircleCI was having internal issues
  - limit was reached in a third party service
- After inspecting the CircleCI logs for eventual errors, it is often worth executing the option `Rerun from failed`.

## Accounts, Keys and Environment Variables

- Environment variables used for configuration are:
  - read from `environments/.env.latest` on the `staging` branch
  - read from `environments/.env.stable` on the `master` branch
  - marked as `xxx` if they are secret keys; when deploying or E2E-testing, they are replaced using `scripts/find_replace.sh`
- Secret keys are tracked in `environments/.env.secrets.gpg`, which is an encrypted file.
- The file can be decrypted using `scripts/decrypt.sh`, and encrypted using `scripts/encrypt.sh`, both scripts requiring the `SECRET_KEY` environment variable.
- [CI/CD](#ci/cd) uses its own [set of environment variables](https://app.circleci.com/settings/project/github/ethereum/sourcify/environment-variables?return-to=https%3A%2F%2Fapp.circleci.com%2Fpipelines%2Fgithub%2Fethereum%2Fsourcify):
  - the Alchemy tokens used in CircleCI are the same ones as used on `staging`.
- The `SECRET_KEY` for decryption as well as Alchemy keys are kept in a password manager.

## Building & Testing Locally

- Sourcify is structured as a monorepo and relies on [lerna](https://github.com/lerna/lerna); the monorepo-related settings are specified in `lerna.json`.
- The first thing to do after cloning the repository is to run:
  ```
  $ npx lerna bootstrap
  ```
- Create the `.env` file in the `environments` directory; it can be modeled after `.env.latest`:
  - Generate an Alchemy API key (same key can work with all `ALCHEMY_ID_*` variables)
  - Designate a path where solc instances will be downloaded (SOLC_REPO)
  - Designate a path where contract files will be stored upon verification (REPOSITORY_PATH)
  - If you're running a custom IPFS node, set `IPFS_URL` to be your endpoint (typically http://127.0.0.1:8080/ipfs/), otherwise use a public service such as https://ipfs.io/ipfs
  - Other `.env` settings:
    - `SERVER_URL=http://localhost:5000`
- The server can be run with one of the following:
  - `$ npm run server:start`
  - selecting the `Server` configuration if you are using VS Code to enable a debugging-compatible environment
- The UI service can be run with:
  ```
  $ cd ui && npm start
  ```
  - There should also be a `ui/.env` file, setting:
    - SERVER_URL (probably http://localhost:5000)
    - REPOSITORY_URL (absolute version of REPOSITORY_PATH, with a `file://` prefix, e.g. file:///home/user1/dir/)
- The Monitor service can be built and run with:
  ```
  $ npm run monitor
  ```
- Other Sourcify runnable configurations can be found in `.vscode/launch.json`.
- Testing:
  - running all tests is performed with:
    ```
    $ npx lerna run test
    ```
  - to run a part of the tests, e.g. all tests containing the string 'metadata' in the file `tests/server.js`:
    ```
    $ npm run test -- tests/server.js --grep "metadata"
    ```

## Code Logic

- The `src` directory's most important subdirectories are:
  - `server`
  - `monitor`
- The `services` directory's most important subdirectories are (they are also published as separate NPM packages):
  - `verification`
  - `validation`
  - `core` - contains common types and functionalities used by other services
- This is a general workflow (some class names are clickable links):
  - [`Server`](https://github.com/ethereum/sourcify/blob/master/src/server/server.ts) accepts requests sending source files, addresses and chain IDs.
  - It uses [`Routes`](https://github.com/ethereum/sourcify/blob/master/src/server/routes.ts), which uses endpoint definitions in:
    - [`FileController`](https://github.com/ethereum/sourcify/blob/master/src/server/controllers/FileController.ts) and
    - [`VerificationController`](https://github.com/ethereum/sourcify/blob/master/src/server/controllers/VerificationController.ts)
  - `VerificationController` checks request validity by calling [`ValidationService`](https://github.com/ethereum/sourcify/blob/master/services/validation/src/ValidationService.ts) and delegates to [`VerificationService`](https://github.com/ethereum/sourcify/blob/master/services/verification/src/services/VerificationService.ts)
  - The `ValidationService` works as follows:
    - unpacks any zip-archives
    - locates the metadata file among the received files
    - searches the rest of the received files to locate the sources specified by the metadata
    - as the search is done according to keccak256 hash, minor fixes are attempted on the source files to try and get the correct version of the file
  - `VerificationService` delegates to [`Injector`](https://github.com/ethereum/sourcify/blob/master/services/verification/src/services/Injector.ts).
  - The `Injector` ultimately decides on whether to `inject` the contract files or not.

## Project Organization and Documentation

- Except for the file you are reading at this moment, relevant information can be found in the following files and directories in the repository:
  - `README.md`
  - `docs/*`
  - `Sourcify.postman_collection.json`
- Organizational issues are discussed on:
  - [sourcifyeth/org/issues](https://github.com/sourcifyeth/org/issues)
- Technical issues are discussed on:
  - [ethereum/sourcify/issues](https://github.com/ethereum/sourcify/issues)
  - [Discord](https://discord.gg/mVA2XdAb)
  - [Gitter](https://gitter.im/ethereum/source-verify)

## Other packages

- Remix plugin
  - https://github.com/sourcifyeth/remix-sourcify
  - Similar in functionality to [the UI](https://sourcify.dev).
  - Development requires interaction with [Remix plugins directory](https://github.com/ethereum/remix-plugins-directory).
  - When publishing a new version of the plugin:
    - build and test (`npm run build` and `npm run serve`)
    - publish to IPFS (target the dist folder with [this script](https://github.com/ethereum/remix-plugins-directory/blob/master/tools/ipfs-upload/bin/upload-remix-plugin))
    - test by [loading the plugin locally](https://remix-ide.readthedocs.io/en/latest/plugin_manager.html#plugin-devs-load-a-local-plugin)
    - make a PR changing the IPFS URL (and possibly other properties) in [the plugin profile](https://github.com/ethereum/remix-plugins-directory/blob/master/plugins/source-verifier/profile.json)
- Hardhat plugin
  - https://github.com/wighawag/hardhat-deploy#5-hardhat-sourcify
  - The recommended (and quite possibly the only) way to verify contracts built with Hardhat.
  - Not developed by the Sourcify team.
- Metacoin Source Verify
  - https://github.com/sourcifyeth/metacoin-source-verify
  - A repository containing contracts and scripts used in E2E testing.
- Geth fork
  - https://github.com/sourcifyeth/go-ethereum
  - Stores the creation data, chain and address of each deployed contract.
  - Set up a local environment:
    - Add an `.env` file modeled after `.env.example`
    - Run the DB with `docker-compose`:
      ```
      $ docker-compose -f postgres.yaml up
      ```
    - Build Geth with:
      ```
      $ make geth
      ```
    - Run the debug configuration in `.vscode/launch.json`:
      - modify the chain flag for different chains (no flag for Mainnet)
    - Alternatively build and run with Docker
      - in `.env`, set `POSTGRES_HOST` to `postgres`
      ```
      $ docker build -t shardlabs/go-ethereum-sourcify:<VERSION> .
      $ docker-compose -f geth-<CHAIN>.yaml up
      ```
    - Check the state of the DB with:
      ```
      $ docker exec -it postgres bash
      # psql <DBNAME> <USERNAME>
      # select * from complete limit 10;
      ```
    - If the output is an almost completely black screen, try scrolling for a few seconds.
