# Get verified contract addresses for the chain

Returns all verified contracts from the repository for the desired chain. Searches for full and partial matches.

**URL** : `/files/contracts/:chain`

**Method** : `GET`

## Responses

**Condition** : Chain is available as a full match or partial match in the repository.

**Code** : `200 OK`

**Content** : 

```json
{
    "full": [
        "0x1fE5d745beABA808AAdF52057Dd7AAA47b42cFD0",
        "0xE9c31091868d68598Ac881738D159A63532d12f9"
    ],
    "partial": [
        "0x0000A906D248Cc99FB8CB296C8Ad8C6Df05431c9",
        "0xE9c31091868d68598Ac881738D159A63532d12f9"
    ]
}
```

### OR

**Condition** : Chain is not available as both full match or partial match in the repository.

**Code** : `404 Not Found`

**Content** : 
```json
{
    "error": "Contracts have not been found!"
}
```
