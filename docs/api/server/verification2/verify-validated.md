# Attempt contract verification

- The received `address`, `chainId` and `compilerVersion` parameters are updated serverside for each provided contract.
- After updating, attempts verification of those contracts that:
  - are successfully validated (no source files missing, as per metadata)
  - have all their parameters specified (`address`, `chainId`, `compilerVersion`)
  - are included in the received object
- The result of verification is available under the `status` property of every contract .

**URL** : `/verify-validated`

**Method** : `POST`

## Responses

**Assumptions for all example responses (except the last one)** :
* There is one pending contract with all source files, but no `address` or `chainId`.
* Supplying the following minimum object (extra properties would be ignored):
```json
{
    "contracts": [
        {
            "address": "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
            "chainId": "100",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
        }
    ]
}
```

**Condition** : The provided contract `perfect`ly matches the one at the provided `chainId` and `address`.

**Code** : `200 OK`

**Content** : 

```json
{
    "contracts": [
        {
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "compiledPath": "browser/1_Storage.sol",
            "name": "Storage",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "address": "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
            "chainId": "100",
            "files": {
                "found": [
                    "browser/1_Storage.sol"
                ],
                "missing": []
            },
            "status": "perfect"
        }
    ],
    "unused": []
}
```

### OR

**Condition** : The contract at the provided `chainId` and `address` has already been verified at `2021-01-12T15:41:56.502Z`.

**Code** : `200 OK`

**Content** : 

```json
{
    "contracts": [
        {
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
            "compiledPath": "browser/1_Storage.sol",
            "name": "Storage",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "address": "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
            "chainId": "100",
            "files": {
                "found": [
                    "browser/1_Storage.sol"
                ],
                "missing": []
            },
            "status": "perfect",
            "storageTimestamp": "2021-01-12T15:41:56.502Z"
        }
    ],
    "unused": []
}
```

### OR

**Condition** : No pending contracts.

**Code** : `400 Bad Request`

**Content** : 
```json
{
    "error": "There are currently no pending contracts."
}
```