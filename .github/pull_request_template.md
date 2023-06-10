<!-- If you are opening a chain support request PR please follow the template below. Otherwise you can write your own PR description -->

# Add New Chain <chainId>

Thanks for your pull request to add a new support in Sourcify.

If you haven't done so, please follow the instructions on [how to request chain support](https://docs.sourcify.dev/docs/chain-support/) in docs.

Please check the following items before submitting your pull request.

## Checklist

- [ ] The branch is named as `add-chain-<chainId>`.
- [ ] I haven't modified the [chains.json](../../src/chains.json) file directly.
- [ ] In [sourcify-chains.ts](../../src/sourcify-chains.ts) file
  - [ ] I've set `supported: true`.
  - [ ] I've set `monitored: false`.
  - [ ] I haven't added an `rpc` field but the one in [chains.json](../../src/chains.json) is used (if not, please explain why).
- [ ] I've added a test in [chain-tests.js](../../test/chains/chains-test.js) file.
- [ ] `test-new-chain` test in Circle CI is passing.
