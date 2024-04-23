// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./ERC20Token.sol";
import "./ERC721Token.sol";

contract Factory {
    event ERC20TokenCreated(address tokenAddress);
    event ERC721TokenCreated(address tokenAddress);

    function deployNewERC20Token(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 initialSupply
    ) public returns (address) {
        ERC20Token t = new ERC20Token(
            name,
            symbol,
            decimals,
            initialSupply,
            msg.sender
        );
        emit ERC20TokenCreated(address(t));

        return address(t);
    }

    function deployNewERC721Token(string memory name, string memory symbol)
        public
        returns (address)
    {
        ERC721Token t = new ERC721Token(name, symbol);
        emit ERC721TokenCreated(address(t));

        return address(t);
    }
}
