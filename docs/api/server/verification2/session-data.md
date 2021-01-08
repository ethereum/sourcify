# Get session data

Returns the object representing the current session.

**URL** : `/session-data`

**Method** : `GET`

## Responses

**Condition** : No input files provided so far.

**Code** : `200 OK`

**Content** : 

```json
{
    "contracts": [],
    "unused": []
}
```

### OR

**Condition** : One metadata file provided so far.

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
            "files": {
                "found": [],
                "missing": [
                    "browser/1_Storage.sol"
                ]
            },
            "status": "error"
        }
    ],
    "unused": []
}
```