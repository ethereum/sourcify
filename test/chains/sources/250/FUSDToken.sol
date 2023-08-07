// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;

import "./@openzeppelin/contracts@2.5.0/token/ERC20/ERC20.sol";
import "./@openzeppelin/contracts@2.5.0/token/ERC20/ERC20Detailed.sol";
import "./@openzeppelin/contracts@2.5.0/token/ERC20/ERC20Mintable.sol";
import "./@openzeppelin/contracts@2.5.0/token/ERC20/ERC20Burnable.sol";
import "./@openzeppelin/contracts@2.5.0/token/ERC20/ERC20Pausable.sol";

/**
 * Implements ERC20 fUSD tokens using OpenZeppelin libraries.
 */
contract FUSDToken is ERC20, ERC20Detailed, ERC20Mintable, ERC20Burnable, ERC20Pausable {
    // create instance of the fUSD token
    constructor () public ERC20Detailed("Fantom StableCoin USD", "FUSD", 18) {
        // mint single token to begin with?
    }
}
