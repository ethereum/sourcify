const metadata = `{
  "compiler": { "version": "0.8.4+commit.c7e474f2" },
  "language": "Solidity",
  "output": {
    "abi": [
      {
        "inputs": [],
        "name": "retrieve",
        "outputs": [
          { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          { "internalType": "uint256", "name": "num", "type": "uint256" }
        ],
        "name": "store",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    "devdoc": {
      "details": "Store & retrieve value in a variable",
      "kind": "dev",
      "methods": {
        "retrieve()": {
          "details": "Return value ",
          "returns": { "_0": "value of 'number'" }
        },
        "store(uint256)": {
          "details": "Store value in variable",
          "params": { "num": "value to store" }
        }
      },
      "title": "Storage",
      "version": 1
    },
    "userdoc": { "kind": "user", "methods": {}, "version": 1 }
  },
`;

export default metadata;
