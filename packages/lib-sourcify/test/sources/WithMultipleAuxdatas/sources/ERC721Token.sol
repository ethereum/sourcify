// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

contract ERC721Token {
    
    event awardNewItem(uint256 indexed newItemId);

    constructor(string memory name, string memory symbol)
    
    {}

    function awardItem(address player, string memory tokenURI)
        public
        returns (uint256)
    {
      return 1;
    }
}
