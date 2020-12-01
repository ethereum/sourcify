# Attempt contract verification

Sends provided files for verification.

**URL** : `/`

**Method** : `POST`

**Body form-data**
* `address`
* `chain`

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

**Condition** : Contract bytecode does not match deployed bytecode.

**Code** : `500 Internal Server Error`

**Content** : 
```json
{
    "error": "Could not match on-chain deployed bytecode to recompiled bytecode for:\n{\n \"browser/ParameterTest.sol\": \"ParameterTest\"\n}\nAddresses checked:\n[\n \"0x0001Db7722Fb4211C24d4aC5E1127353116323d3\"\n]"
}
```