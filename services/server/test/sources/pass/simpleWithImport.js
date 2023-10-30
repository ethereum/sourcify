// SimpleWithImport.sol: contract which imports another contract
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
        name: "minusOne",
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
      {
        inputs: [
          {
            internalType: "uint256",
            name: "_value",
            type: "uint256",
          },
        ],
        name: "plusOne",
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
          "0x608060405234801561001057600080fd5b50610105806100206000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c8063a0c2e3f3146037578063f5a6259f146076575b600080fd5b606060048036036020811015604b57600080fd5b810190808035906020019092919050505060b5565b6040518082815260200191505060405180910390f35b609f60048036036020811015608a57600080fd5b810190808035906020019092919050505060c2565b6040518082815260200191505060405180910390f35b6000600182039050919050565b600060018201905091905056fea2646970667358221220cebb6bef879277a9329fc554779f5c840cf918aa8261c368f855e8b61fa7c6dc64736f6c63430006000033",
      },
      deployedBytecode: {
        object:
          "0x6080604052348015600f57600080fd5b506004361060325760003560e01c8063a0c2e3f3146037578063f5a6259f146076575b600080fd5b606060048036036020811015604b57600080fd5b810190808035906020019092919050505060b5565b6040518082815260200191505060405180910390f35b609f60048036036020811015608a57600080fd5b810190808035906020019092919050505060c2565b6040518082815260200191505060405180910390f35b6000600182039050919050565b600060018201905091905056fea2646970667358221220cebb6bef879277a9329fc554779f5c840cf918aa8261c368f855e8b61fa7c6dc64736f6c63430006000033",
      },
    },
    metadata:
      '{"compiler":{"version":"0.6.0+commit.26b70077"},"language":"Solidity","output":{"abi":[{"inputs":[{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"minusOne","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"plusOne","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"}],"devdoc":{"author":"Mary A. Botanist","details":"For testing source-verify","methods":{"minusOne(uint256)":{"author":"Mary A. Botanist","details":"For testing source-verify","params":{"_value":"A number"},"returns":{"_0":"The number minus one"}},"plusOne(uint256)":{"author":"Mary A. Botanist","details":"For testing source-verify","params":{"_value":"A number"},"returns":{"_0":"The number plus one"}}},"title":"A simple contract"},"userdoc":{"methods":{"minusOne(uint256)":{"notice":"This function will subtract 1 from `_value`"},"plusOne(uint256)":{"notice":"This function will add 1 to `_value`"}},"notice":"You can add one to a value, or subtract one."}},"settings":{"compilationTarget":{"/Users/cgewecke/code/ef/ts/contracts/SimpleWithImport.sol":"SimpleWithImport"},"evmVersion":"istanbul","libraries":{},"metadata":{"bytecodeHash":"ipfs"},"optimizer":{"enabled":false,"runs":200},"remappings":[]},"sources":{"/Users/cgewecke/code/ef/ts/contracts/Import.sol":{"keccak256":"0x0eccd3c879b832a2860fcb35d5981fd95921cc543bfdd0eac1b8cd6d66880582","urls":["bzz-raw://6453db3a40a99904ee01f85dbbc71fb036679215803b2efd075cc71a60fb2b7f","dweb:/ipfs/QmYYGcypiit8VQ7vyJPHUPfgiBcBW8StVM1t71JzaGbhNm"]},"/Users/cgewecke/code/ef/ts/contracts/SimpleWithImport.sol":{"keccak256":"0x3e70e021142df107f8b1815b146ad865f4e0a09e6fe71f8b0117c3638065cbef","urls":["bzz-raw://1378744c83bb94bab985e6bc1104d4942964151cf0c8fdc86ff29c1cd13d021c","dweb:/ipfs/QmbCorezT6RnFM7kTQHALvKkTdeaK8Uqc9coyKo47Fxuq2"]}},"version":1}',
  },
  sourceCodes: {
    "SimpleWithImport.sol":
      'pragma solidity ^0.6.0;\n\nimport "./Import.sol";\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can add one to a value, or subtract one.\n/// @dev For testing source-verify\ncontract SimpleWithImport is Import {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @dev For testing source-verify\n    /// @param _value A number\n    /// @return The number plus one\n    function plusOne(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n',
    "Import.sol":
      "pragma solidity ^0.6.0;\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can subtract one from a value.\n/// @dev For testing source-verify\ncontract Import {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will subtract 1 from `_value`\n    /// @dev For testing source-verify\n    /// @param _value A number\n    /// @return The number minus one\n    function minusOne(uint _value) public pure returns (uint) {\n        return _value - 1;\n    }\n}\n",
  },
};
