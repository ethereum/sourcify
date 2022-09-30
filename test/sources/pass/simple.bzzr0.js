// Simple.sol (swarm hash: bzzr0 )
// solc 0.5.9
module.exports = {
  compilerOutput: {
    abi: [
      {
        constant: true,
        inputs: [
          {
            name: "_value",
            type: "uint256",
          },
        ],
        name: "plusOne",
        outputs: [
          {
            name: "",
            type: "uint256",
          },
        ],
        payable: false,
        stateMutability: "pure",
        type: "function",
      },
    ],
    evm: {
      bytecode: {
        object:
          "0x6080604052348015600f57600080fd5b5060ae8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea265627a7a7230582061cddc8af3ed3c1f2dc2cacf4c6086aed126de035f9f92e98906e86b8da3f8f564736f6c63430005090032",
      },
      deployedBytecode: {
        object:
          "0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063f5a6259f14602d575b600080fd5b605660048036036020811015604157600080fd5b8101908080359060200190929190505050606c565b6040518082815260200191505060405180910390f35b600060018201905091905056fea265627a7a7230582061cddc8af3ed3c1f2dc2cacf4c6086aed126de035f9f92e98906e86b8da3f8f564736f6c63430005090032",
      },
    },
    metadata:
      '{"compiler":{"version":"0.5.9+commit.e560f70d"},"language":"Solidity","output":{"abi":[{"constant":true,"inputs":[{"name":"_value","type":"uint256"}],"name":"plusOne","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"}],"devdoc":{"author":"Mary A. Botanist","details":"For testing source-verify","methods":{"plusOne(uint256)":{"author":"Mary A. Botanist","details":"For testing source-verify","params":{"_value":"A number"},"return":"The number plus one"}},"title":"A simple contract"},"userdoc":{"methods":{"plusOne(uint256)":{"notice":"This function will add 1 to `_value`"}},"notice":"You can add one to a value."}},"settings":{"compilationTarget":{"/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/Simple.sol":"Simple"},"evmVersion":"petersburg","libraries":{},"optimizer":{"enabled":false,"runs":200},"remappings":[]},"sources":{"/Users/cgewecke/code/sv-bzzr/source-verify/test/sources/contracts/Simple.sol":{"keccak256":"0xaf98ed9a905c76fb1daffb0a4fca05686b2331cc1ac5132de42252c96ac1d363","urls":["bzzr://2feba6d1633604a372379a7dfe2d136480473e182a34b87e5ae1cecdaac41759","dweb:/ipfs/QmaUG79gTHmjtCBd4tMuu4CMieoqguMDLcQFcdbejBe6Wh"]}},"version":1}',
  },
  sourceCodes: {
    "Simple.sol":
      "pragma solidity ^0.5.9;\n\n/// @title A simple contract\n/// @author Mary A. Botanist\n/// @notice You can add one to a value.\n/// @dev For testing source-verify\ncontract Simple {\n\n    /// @author Mary A. Botanist\n    /// @notice This function will add 1 to `_value`\n    /// @param _value A number\n    /// @dev For testing source-verify\n    /// @return The number plus one\n    function plusOne(uint _value) public pure returns (uint) {\n        return _value + 1;\n    }\n}\n",
  },
};
