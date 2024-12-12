&nbsp;

<p align="center">
  &nbsp;
  <a href="https://sourcify.dev"><img src="https://raw.githubusercontent.com/sourcifyeth/assets/master/logo-assets-svg/logoText.svg" alt="sourcify logo" role="presentation"></a>
</p>

[![codecov](https://codecov.io/gh/ethereum/sourcify/branch/staging/graph/badge.svg?token=eN6XDAwWfV)](https://codecov.io/gh/ethereum/sourcify)

Sourcify ([sourcify.dev](https://sourcify.dev)) is a source code verification service for Ethereum smart contracts supporting Solidity and Vyper.

Different than other verification services, Sourcify leverages the [metadata](https://docs.sourcify.dev/docs/metadata/) file to ["fully verify"](https://docs.sourcify.dev/docs/full-vs-partial-match/) the Solidity contracts.

Sourcify mainly consists of:

- [sourcify-server](/services/server) - an HTTP server to do verifications and store the verified contracts for supported chains through an [API](https://docs.sourcify.dev/docs/api/)
- [sourcify-monitor](/services/monitor) - a standalone service that listens to various EVM chains for new contract creations and automatically submits them to a Sourcify API for verification.
- Packages:
  - [@ethereum-sourcify/lib-sourcify](/packages/lib-sourcify/): The core library for Sourcify. It contains the logic to verify contracts.
  - [@ethereum-sourcify/bytecode-utils](/packages/bytecode-utils/): A library to extract and parse the CBOR encoded metadata from the bytecode.
- [Sourcify UI](https://github.com/sourcifyeth/ui) - a web UI to interact with the server, lookup, and verify contracts

The project aims to serve as a public good infrastructure with fully open-source development and an [open and accessible contract repository](https://docs.sourcify.dev/docs/repository/) of verified contracts. Anyone can easily run their own Sourcify server and monitor to verify contracts on their own. We also aim to provide tooling to verify contracts easier on different platforms e.g. browers.

_ℹ️ [This monorepo](https://github.com/ethereum/sourcify) contains the main modules. The [sourcifyeth Github organization](https://github.com/sourcifyeth) contains all other auxiliary services and components._

## Documentation

For more details refer to [docs.sourcify.dev](https://docs.sourcify.dev/docs/intro/)

## Questions?

🔍 Check out docs [F.A.Q.](https://docs.sourcify.dev/docs/faq/) and use search in docs.

💬 Chat with us on [Matrix chat](https://matrix.to/#/#ethereum_source-verify:gitter.im) or [Discord](https://discord.gg/6aqd9cfZ9s)

🐦 Follow us and help us spread the word on [Twitter](https://twitter.com/SourcifyEth).

## Adding a new chain

If you'd like to add a new chain support to Sourcify please follow the [chain support instructions](https://docs.sourcify.dev/docs/chain-support/) in docs.
