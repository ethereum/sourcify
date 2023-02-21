// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

library Lib {
    function foo() public pure returns (string memory) {
        return "hello from foo";
    }
}

contract Con {
    function bar() public pure returns (string memory) {
        return Lib.foo();
    }
}