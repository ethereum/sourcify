// SimpleWithLibrary.sol
// solc 0.6.0
module.exports = {
  "compilerOutput": {
    "abi": [
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "plusOne",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "plusTwenty",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      }
    ],
    "evm": {
      "bytecode": {
        "linkReferences": {
          "/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/Library.sol": {
            "Library": [
              {
                "length": 20,
                "start": 227
              },
              {
                "length": 20,
                "start": 253
              }
            ]
          }
        },
        "object": "0x608060405234801561001057600080fd5b5061021e806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806302c723771461003b578063f5a6259f1461007d575b600080fd5b6100676004803603602081101561005157600080fd5b81019080803590602001909291905050506100bf565b6040518082815260200191505060405180910390f35b6100a96004803603602081101561009357600080fd5b81019080803590602001909291905050506101db565b6040518082815260200191505060405180910390f35b600073__$6847f43b8cc746bbce5fd72e542ad65042$__63e4eb787473__$6847f43b8cc746bbce5fd72e542ad65042$__63e4eb7874856040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b15801561012a57600080fd5b505af415801561013e573d6000803e3d6000fd5b505050506040513d602081101561015457600080fd5b81019080805190602001909291905050506040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b15801561019957600080fd5b505af41580156101ad573d6000803e3d6000fd5b505050506040513d60208110156101c357600080fd5b81019080805190602001909291905050509050919050565b600060018201905091905056fea2646970667358221220f00e2bef73df1c72a6a21a114901149e0c1b35bfadc7109a50c01017c12ef54164736f6c63430006000033",
      },
      "deployedBytecode": {
        "linkReferences": {
          "/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/Library.sol": {
            "Library": [
              {
                "length": 20,
                "start": 195
              },
              {
                "length": 20,
                "start": 221
              }
            ]
          }
        },
        "object": "0x608060405234801561001057600080fd5b50600436106100365760003560e01c806302c723771461003b578063f5a6259f1461007d575b600080fd5b6100676004803603602081101561005157600080fd5b81019080803590602001909291905050506100bf565b6040518082815260200191505060405180910390f35b6100a96004803603602081101561009357600080fd5b81019080803590602001909291905050506101db565b6040518082815260200191505060405180910390f35b600073__$6847f43b8cc746bbce5fd72e542ad65042$__63e4eb787473__$6847f43b8cc746bbce5fd72e542ad65042$__63e4eb7874856040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b15801561012a57600080fd5b505af415801561013e573d6000803e3d6000fd5b505050506040513d602081101561015457600080fd5b81019080805190602001909291905050506040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b15801561019957600080fd5b505af41580156101ad573d6000803e3d6000fd5b505050506040513d60208110156101c357600080fd5b81019080805190602001909291905050509050919050565b600060018201905091905056fea2646970667358221220f00e2bef73df1c72a6a21a114901149e0c1b35bfadc7109a50c01017c12ef54164736f6c63430006000033",
      }
    },
    "metadata": "{\"compiler\":{\"version\":\"0.6.0+commit.26b70077\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_value\",\"type\":\"uint256\"}],\"name\":\"plusOne\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_value\",\"type\":\"uint256\"}],\"name\":\"plusTwenty\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"pure\",\"type\":\"function\"}],\"devdoc\":{\"author\":\"Mary A. Botanist\",\"details\":\"For testing source-verify\",\"methods\":{\"plusOne(uint256)\":{\"author\":\"Mary A. Botanist\",\"details\":\"For testing source-verify\",\"params\":{\"_value\":\"A number\"},\"returns\":{\"_0\":\"The number plus one\"}},\"plusTwenty(uint256)\":{\"author\":\"Mary A. Botanist\",\"details\":\"For testing source-verify\",\"params\":{\"_value\":\"A number\"},\"returns\":{\"_0\":\"The number plus twenty\"}}},\"title\":\"A simple contract\"},\"userdoc\":{\"methods\":{\"plusOne(uint256)\":{\"notice\":\"This function will add 1 to `_value`\"},\"plusTwenty(uint256)\":{\"notice\":\"This function will add 1 to `_value`\"}},\"notice\":\"You can add one to a value.\"}},\"settings\":{\"compilationTarget\":{\"/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/SimpleWithLibrary.sol\":\"SimpleWithLibrary\"},\"evmVersion\":\"istanbul\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":false,\"runs\":200},\"remappings\":[]},\"sources\":{\"/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/Library.sol\":{\"keccak256\":\"0x5ba0062b16415175326f5bafba06d0762f56a503716c2b3d5162bf81febb73fb\",\"urls\":[\"bzz-raw://2db6c96b80d2c4e0858235044762de295f981d584ba3cd8d725d89eec3c6a684\",\"dweb:/ipfs/QmNs68H46FUwLrM24g8PxedJoHDKMQ7bu5gur25ySctga1\"]},\"/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/SimpleWithLibrary.sol\":{\"keccak256\":\"0x95f777a7c361a2fe5c32ab82ce52db9c907203218e951ec1a244d8fa4686228e\",\"urls\":[\"bzz-raw://ba0dc4ac258523337eb3531edafc1a12b4a6fe45972cb1a4b9694b599a45e71b\",\"dweb:/ipfs/QmXWh7VfTyLQaT1DJkcmJtCnpPb3yX3X9wLkuHzngRF5cC\"]}},\"version\":1}"
  },
  "sourceCodes": {
    "SimpleWithLibrary.sol": "pragma solidity ^0.6.0;\n\nimport \"./Library.sol\";\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can add one to a value.\n/// @dev For testing source-verify\ncontract SimpleWithLibrary {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @param _value A number\n    /// @dev For testing source-verify\n    /// @return The number plus one\n    function plusOne(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @param _value A number\n    /// @dev For testing source-verify\n    /// @return The number plus twenty\n    function plusTwenty(uint _value) public pure returns (uint) {\n      return Library.plusTen(\n        Library.plusTen(_value)\n      );\n    }\n}",
    "Library.sol": "pragma solidity ^0.6.0;\n\n/// @title A simple library\n/// @author Alexandra A. Alexandria\n/// @notice You can add ten to a value.\n/// @dev For testing source-verify\nlibrary Library {\n\n    /// @author Alexandra A. Alexandria\n    /// @notice This function will add 10 to `_value`\n    /// @dev For testing source-verify\n    /// @param _value A number\n    /// @return The number plus 10\n    function plusTen(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n"
  }
}
