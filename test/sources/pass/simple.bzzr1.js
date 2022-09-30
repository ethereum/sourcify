// Simple.sol (swarm hash)
// solc 0.6.0
// solc setting "metadata: { bytecodeHash: bzzr1 }"
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
          "0x6080604052348015600f57600080fd5b5060ae8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea265627a7a72315820aa60c87120e069cec3c968c793106c34d239ac3ff373df460f999ed0460a58e964736f6c63430006000032",
      },
      deployedBytecode: {
        object:
          "0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea265627a7a72315820aa60c87120e069cec3c968c793106c34d239ac3ff373df460f999ed0460a58e964736f6c63430006000032",
      },
    },
    metadata:
      '{"compiler":{"version":"0.6.0+commit.26b70077"},"language":"Solidity","output":{"abi":[{"inputs":[{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"plusOne","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"}],"devdoc":{"author":"Mary A. Botanist","details":"For testing source-verify","methods":{"plusOne(uint256)":{"author":"Mary A. Botanist","details":"For testing source-verify","params":{"_value":"A number"},"returns":{"_0":"The number plus one"}}},"title":"A simple contract"},"userdoc":{"methods":{"plusOne(uint256)":{"notice":"This function will add 1 to `_value`"}},"notice":"You can add one to a value."}},"settings":{"compilationTarget":{"/Users/cgewecke/code/ef/source-verify/test/sources/contracts/Simple.sol":"Simple"},"evmVersion":"istanbul","libraries":{},"metadata":{"bytecodeHash":"bzzr1"},"optimizer":{"enabled":false,"runs":200},"remappings":[]},"sources":{"/Users/cgewecke/code/ef/source-verify/test/sources/contracts/Simple.sol":{"keccak256":"0xc841b70bf4cba7771c1ddf05207b0e896fdb9e7df88950abac82a61968b83307","urls":["bzz-raw://1b9ad6afbb7c63f1cadf5748d50e996c798f2d72a830088a1295037fa9ec3c41","dweb:/ipfs/QmZRr1Kunzs17jKqhDrP6AEpz1TeRZVf7HKnyDWpfFB4w9"]}},"version":1}',
  },
  sourceCodes: {
    "Simple.sol":
      "pragma solidity ^0.6.0;\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can add one to a value.\n/// @dev For testing source-verify\ncontract Simple {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @param _value A number\n    /// @dev For testing source-verify\n    /// @return The number plus one\n    function plusOne(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n",
  },
};
