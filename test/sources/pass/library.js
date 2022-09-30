// Library.sol
// solc 0.6.0
module.exports = {
  compilerOutput: {
    abi: [
      {
        inputs: [
          {
            internalType: "uint256",
            name: "_value",
            type: "uint256",
          },
        ],
        name: "plusTen",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "pure",
        type: "function",
      },
    ],
    evm: {
      bytecode: {
        object:
          "0x60ba610025600b82828239805160001a60731461001857fe5b30600052607381538281f3fe730000000000000000000000000000000000000000301460806040526004361060335760003560e01c8063e4eb7874146038575b600080fd5b606160048036036020811015604c57600080fd5b81019080803590602001909291905050506077565b6040518082815260200191505060405180910390f35b600060018201905091905056fea2646970667358221220a41bf0241edd9775c7d1c89ad6023488ce859ac884b0fe43ca558fae3572693a64736f6c63430006000033",
      },
      deployedBytecode: {
        object:
          "0x730000000000000000000000000000000000000000301460806040526004361060335760003560e01c8063e4eb7874146038575b600080fd5b606160048036036020811015604c57600080fd5b81019080803590602001909291905050506077565b6040518082815260200191505060405180910390f35b600060018201905091905056fea2646970667358221220a41bf0241edd9775c7d1c89ad6023488ce859ac884b0fe43ca558fae3572693a64736f6c63430006000033",
      },
    },
    metadata:
      '{"compiler":{"version":"0.6.0+commit.26b70077"},"language":"Solidity","output":{"abi":[{"inputs":[{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"plusTen","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"}],"devdoc":{"author":"Alexandra A. Alexandria","details":"For testing source-verify","methods":{"plusTen(uint256)":{"author":"Alexandra A. Alexandria","details":"For testing source-verify","params":{"_value":"A number"},"returns":{"_0":"The number plus 10"}}},"title":"A simple library"},"userdoc":{"methods":{"plusTen(uint256)":{"notice":"This function will add 10 to `_value`"}},"notice":"You can add ten to a value."}},"settings":{"compilationTarget":{"/Users/cgewecke/code/ef/source-verify/test/sources/contracts/Library.sol":"Library"},"evmVersion":"istanbul","libraries":{},"metadata":{"bytecodeHash":"ipfs"},"optimizer":{"enabled":false,"runs":200},"remappings":[]},"sources":{"/Users/cgewecke/code/ef/source-verify/test/sources/contracts/Library.sol":{"keccak256":"0x5ba0062b16415175326f5bafba06d0762f56a503716c2b3d5162bf81febb73fb","urls":["bzz-raw://2db6c96b80d2c4e0858235044762de295f981d584ba3cd8d725d89eec3c6a684","dweb:/ipfs/QmNs68H46FUwLrM24g8PxedJoHDKMQ7bu5gur25ySctga1"]}},"version":1}',
  },
  sourceCodes: {
    "Library.sol":
      "pragma solidity ^0.6.0;\n\n/// @title A simple library\n/// @author Alexandra A. Alexandria\n/// @notice You can add ten to a value.\n/// @dev For testing source-verify\nlibrary Library {\n\n    /// @author Alexandra A. Alexandria\n    /// @notice This function will add 10 to `_value`\n    /// @dev For testing source-verify\n    /// @param _value A number\n    /// @return The number plus 10\n    function plusTen(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n",
  },
};
