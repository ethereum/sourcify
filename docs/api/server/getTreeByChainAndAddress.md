# Get file tree

Returns repository URLs for every file in the source tree for the desired chain and address. Searches only for full matches.

**URL** : `/files/tree/:chain/:address`

**Method** : `GET`

## Responses

**Condition** : Contract is available in the repository.

**Code** : `200 OK`

**Content** : 

```json
[
    "https://contractrepo.sourcify.shardlabs.hr/contracts/full_match/5/0x1fE5d745beABA808AAdF52057Dd7AAA47b42cFD0/metadata.json",
    "https://contractrepo.sourcify.shardlabs.hr/contracts/full_match/5/0x1fE5d745beABA808AAdF52057Dd7AAA47b42cFD0/sources/browser/ERC20Standard.sol"
]
```

### OR

**Condition** : Contract is not available in the repository.

**Code** : `404 Not Found`

**Content** : 
```json
{
    "error": "Files have not been found!"
}
```