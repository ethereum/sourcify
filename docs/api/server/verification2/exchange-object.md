## Server -> Client (1)
The object sent from the server to the client is of the following form:

```json
{
    "contracts": [
        {
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "address": null,
            "chainId": null,
            "compiledPath": "browser/1_Storage.sol",
            "name": "Storage",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "files": {
                "found": [
                    "browser/1_Storage.sol"
                ],
                "missing": []
            },
            "status": "error",
            "statusMessage": "message",
            "storageTimestamp": "2021-01-12T15:41:56.502Z"
        }
    ],
    "unused": []
}
```

### `status`
- The `status` property can hold either the value `perfect`, `partial` or `error`.
- The first two indicate the level of matching obtained during verification.
- `error` indicates that verification has not yet been successfully run.
- More information about `status` might be provided under `statusMessage`.
- If a `storageTimestamp` is provided, the contract was already previously verified at the indicated point in time.

## Client -> Server (2)
The object expected by the server from the client is a proper subset of (1) and is of the following form:
```json
{
    "contracts": [
        {
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "address": "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
            "chainId": "100",
            "compilerVersion": "0.6.6+commit.6c089d02"
        }
    ],
    "fetch": true // if true or "true", then considered true, all other values are treated as false
}
```
- If the client does not know some of the properties yet, they may be omitted.
- If any other properties are added to (2), the server ignores them. That is, a client may simply alter one property (e.g. `address`) of the object of the form (1) and send it to server via `POST /verify-validated`.