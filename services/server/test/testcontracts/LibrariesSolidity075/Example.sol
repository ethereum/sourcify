// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

library Lib {
    function sum(uint256 a, uint256 b) external returns (uint256) {
        return a + b;
    }
}
 
contract A {
    function sum(uint256 a, uint256 b) external returns (uint256) {
        return Lib.sum(a, b);
    }
}