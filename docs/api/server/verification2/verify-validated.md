# Attempt contract verification

- The received `address`, `networkId` and `compilerVersion` parameters are updated serverside for each provided contract.
- After updating, attempts verification of those contracts that:
  - are successfully validated (no source files missing, as per metadata)
  - have all their parameters specified (`address`, `networkId`, `compilerVersion`)
  - are included in the received object
- The result of verification is available under the `status` property of every contract .

**URL** : `/verify-validated`

**Method** : `POST`

## Responses

**Assumptions for all example responses (except the last)** :
* There is one pending contract with 0 or 1 missing source file, but no `address` or `networkId`.
* Supplying the following minimum object:
```json
{
    "contracts": [
        {
            "address": "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
            "networkId": "100",
            "compilerVersion": "0.6.6+commit.6c089d02",
            "verificationId": "0x3f67e9f57515bb1e7195c7c5af1eff630091567c0bb65ba3dece57a56da766fe",
        }
    ]
}
```

**Conditions** :
- All the source files have been previously provided.
- The provided contract `perfect`ly matches the one at the provided `networkId` and `address`.

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
            "networkId": "100",
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

**Conditions** :
- One source file is missing.
- Fetching requested by providing `fetch: true`, look [here](exchange-object.md) for more info.
- The provided contract `perfect`ly matches the one at the provided `networkId` and `address`.

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
            "networkId": "100",
            "files": {
                "found": [
                    "browser/1_Storage.sol"
                ],
                "missing": []
            },
            "status": "perfect"
        }
    ],
    "unused": [],
    "fetch": true
}
```

### OR

**Condition** : The contract at the provided `networkId` and `address` has already been verified at `2021-01-12T15:41:56.502Z`.

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
            "networkId": "100",
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