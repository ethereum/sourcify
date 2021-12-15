# Check all by addresses

Checks if contract with the desired chain and address is verified and in the repository. It will search for both perfect and partial matches.

**URL** : `check-all-by-addresses?addresses={address}&chainIds={chainIds}`

**URL (deprecated)** : `checkAllByAddresses?addresses={address}&chainIds={chainIds}`

**Method** : `GET`

## Response

**Code** : `200 OK`

**Content** : 

```json
[
    {
        "address": "0x0000A906D248Cc99FB8CB296C8Ad8C6Df05431c9",
        "chainIds": [
          {
            chainId: '1',
            status: 'perfect'
          }
        ]
    },
    {
        "address": "0x0A67477639a71bf98528280D3724f465A1814740",
        "chainIds": [
          {
            chainId: '1',
            status: 'perfect'
          }
          {
            chainId: '5',
            status: 'partial'
          }
        ]
    },
]
```

**Code** : `404 NOT FOUND`

**Content** : 

```json
[
  {
    "address": "0x0A67477639a71bf98528280D3724f465A1814741",
    "status": "false"
  },
]
```