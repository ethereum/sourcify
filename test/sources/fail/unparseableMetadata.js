// Simple.sol
// Metadata is not valid json
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
          "0x6080604052348015600f57600080fd5b5060af8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea264697066735822122027dd4cf14e2403b843ff81265ccea90bd3be07efc0d0bb7c2d8ce276fac7df5864736f6c63430006000033",
      },
      deployedBytecode: {
        object:
          "0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea264697066735822122027dd4cf14e2403b843ff81265ccea90bd3be07efc0d0bb7c2d8ce276fac7df5864736f6c63430006000033",
      },
    },
    metadata: '{"compiler":{',
  },
  sourceCodes: {
    "Simple.sol":
      "pragma solidity ^0.6.0;\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can add one to a value.\n/// @dev For testing source-verify\ncontract Simple {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @param _value A number\n    /// @dev For testing source-verify\n    /// @return The number plus one\n    function plusOne(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n",
  },
};
