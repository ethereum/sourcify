# Attempt contract verification

Sends provided files for verification.

**URL** : `/verify` or `/`

**Method** : `POST`

**Content-Type** : `multipart/form-data` or `application/json`

Regardless of the Content-Type, the body should provide:
- `address`
- `chain`

If using `multipart/form-data`, the files should be in a field named `files`.
If using `application/json`, the files should be in an object under the key `files` so the whole object is of the form:
```json
{
    "address": ...,
    "chain": ...,
    "files": {
        "file-name1.sol": ...,
        "file-name2.sol": ...
    }
}
```

## Responses

**Condition** : Contract is perfect match.

**Code** : `200 OK`

**Content** : 

```json
{
    "result": [
        {
            "address": "0x0001Db7722Fb4211C24d4aC5E1127353116323d3",
            "status": "perfect"
        }
    ]
}
```
### OR

**Condition** : Contract is partial match.

**Code** : `200 OK`

**Content** : 

```json
{
    "result": [
        {
            "address": "0x0001Db7722Fb4211C24d4aC5E1127353116323d3",
            "status": "partial"
        }
    ]
}
```

### OR
**Condition** : Missing or invalid parameters received.

**Code** : `400 Bad Request`

**Content** :
```json
{
    "error": "Missing body parameters: address, chain"
}
```

### OR

**Condition** : Failed fetching missing files. OR Contract bytecode does not match deployed bytecode.

**Code** : `500 Internal Server Error`

**Content** : 
```json
{
    "error": "Could not match on-chain deployed bytecode to recompiled bytecode for:\n{\n \"browser/ParameterTest.sol\": \"ParameterTest\"\n}\nAddresses checked:\n[\n \"0x0001Db7722Fb4211C24d4aC5E1127353116323d3\"\n]"
}
```