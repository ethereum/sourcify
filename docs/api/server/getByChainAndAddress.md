# Get source files for the address

Returns all verified sources from the repository for the desired contract address and chain, including `metadata.json`.

**URL** : `/files/:chain/:address`

**Method** : `GET`

## Responses

**Condition** : Contract is available in the repository.

**Code** : `200 OK`

**Content** : 

```json
[
    {
        "name": "metadata.json",
        "path": "/home/data/repository/contracts/full_match/3/0x0000A906D248Cc99FB8CB296C8Ad8C6Df05431c9/metadata.json",
        "content": "{\"compiler\":{\"version\":\"0.6.6+commit.6c089d02\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[],\"name\":\"retreive\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"num\",\"type\":\"uint256\"}],\"name\":\"store\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}],\"devdoc\":{\"details\":\"Store & retreive value in a variable\",\"methods\":{\"retreive()\":{\"details\":\"Return value \",\"returns\":{\"_0\":\"value of 'number'\"}},\"store(uint256)\":{\"details\":\"Store value in variable\",\"params\":{\"num\":\"value to store\"}}},\"title\":\"Storage\"},\"userdoc\":{\"methods\":{}}},\"settings\":{\"compilationTarget\":{\"browser/1_Storage.sol\":\"Storage\"},\"evmVersion\":\"istanbul\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":true,\"runs\":200},\"remappings\":[]},\"sources\":{\"browser/1_Storage.sol\":{\"keccak256\":\"0xaedc7086ad8503907209f50bac1e4dc6c2eca2ed41b15d03740fea748ea3f88e\",\"urls\":[\"bzz-raw://4bc331951c25951321cb29abbd689eb3af669530222c6bb2d45ff45334ee83a7\",\"dweb:/ipfs/QmWb1NQ6Pw8ZLMFX8uDjMyftgcEieT9iP2TvWisPhjN3U2\"]}},\"version\":1}"
    },
    {
        "name": "1_Storage.sol",
        "path": "/home/data/repository/contracts/full_match/3/0x0000A906D248Cc99FB8CB296C8Ad8C6Df05431c9/sources/browser/1_Storage.sol",
        "content": "pragma solidity >=0.4.22 <0.7.0;\n\n/**\n * @title Storage\n * @dev Store & retreive value in a variable\n */\ncontract Storage {\n\n    uint256 number;\n\n    /**\n     * @dev Store value in variable\n     * @param num value to store\n     */\n    function store(uint256 num) public {\n        number = num;\n    }\n\n    /**\n     * @dev Return value \n     * @return value of 'number'\n     */\n    function retreive() public view returns (uint256){\n        return number;\n    }\n}"
    }
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