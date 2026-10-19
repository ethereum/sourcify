## before

- Add the `BLOCKSCOUT_PRO_API_KEY` secret to the staging and production server environments (PR 3029). The server uses the Blockscout PRO API key for fetching the creation tx and for the BlockscoutVerify storage service on chains with `blockscoutApi.proApi: true`. Without the key, these chains keep using the rate-limited instance URLs.
