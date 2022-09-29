// Simple.sol (include literal source contents instead of urls)
// solc 0.6.0
// solc setting "metadata: { "useLiteralContent": true }"
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
          "0x6080604052348015600f57600080fd5b5060af8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea2646970667358221220b0dc552ed70d287056c5a76b08d82bfb9129bb5c04464d1de5d1b74c76b2cfd264736f6c63430006000033",
      },
      deployedBytecode: {
        object:
          "0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea2646970667358221220b0dc552ed70d287056c5a76b08d82bfb9129bb5c04464d1de5d1b74c76b2cfd264736f6c63430006000033",
      },
    },
    metadata:
      '{"compiler":{"version":"0.6.0+commit.26b70077"},"language":"Solidity","output":{"abi":[{"inputs":[{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"plusOne","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"}],"devdoc":{"author":"Mary A. Botanist","details":"For testing source-verify","methods":{"plusOne(uint256)":{"author":"Mary A. Botanist","details":"For testing source-verify","params":{"_value":"A number"},"returns":{"_0":"The number plus one"}}},"title":"A simple contract"},"userdoc":{"methods":{"plusOne(uint256)":{"notice":"This function will add 1 to `_value`"}},"notice":"You can add one to a value."}},"settings":{"compilationTarget":{"/Users/cgewecke/code/ef/source-verify/test/sources/contracts/Simple.sol":"Simple"},"evmVersion":"istanbul","libraries":{},"metadata":{"bytecodeHash":"ipfs","useLiteralContent":true},"optimizer":{"enabled":false,"runs":200},"remappings":[]},"sources":{"/Users/cgewecke/code/ef/source-verify/test/sources/contracts/Simple.sol":{"content":"pragma solidity ^0.6.0;\\n\\n/// @title A simple contract\\n/// @author Mary A. Botanist\\n/// @notice You can add one to a value.\\n/// @dev For testing source-verify\\ncontract Simple {\\n\\n    /// @author Mary A. Botanist\\n    /// @notice This function will add 1 to `_value`\\n    /// @param _value A number\\n    /// @dev For testing source-verify\\n    /// @return The number plus one\\n    function plusOne(uint _value) public pure returns (uint) {\\n        return _value + 1;\\n    }\\n}\\n","keccak256":"0xc841b70bf4cba7771c1ddf05207b0e896fdb9e7df88950abac82a61968b83307"}},"version":1}',
  },
  sourceCodes: {
    "Simple.sol":
      "pragma solidity ^0.6.0;\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can add one to a value.\n/// @dev For testing source-verify\ncontract Simple {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @param _value A number\n    /// @dev For testing source-verify\n    /// @return The number plus one\n    function plusOne(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n",
  },
};
