## before

- Create the Secret Manager secrets `BLOCKSCOUT_PRO_API_KEY_STAGING` and `BLOCKSCOUT_PRO_API_KEY_PRODUCTION` with the Blockscout PRO API key (PR 3029). Map them to the env var `BLOCKSCOUT_PRO_API_KEY` on the Cloud Run services `sourcify-staging-server` and `sourcify-production-server`, the same as `ETHERSCAN_API_KEY`. The server uses the key for fetching the creation tx and for the BlockscoutVerify storage service on chains with `blockscoutApi.proApi: true`. Without the key, these chains keep using the rate-limited instance URLs.
- Add `BLOCKSCOUT_PRO_API_KEY` to the CircleCI project settings as an environment variable. Without it, the live PRO API test in the `test-creation-tx-apis` job always skips.
