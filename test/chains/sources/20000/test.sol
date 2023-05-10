// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract numbers {
    uint256 public number;
    constructor(uint256 _number){
        number = _number;
    }

    function newNumber(uint256 _newNumber) public {
        number = _newNumber;
    }

    function resetNumber() public {
        number = 0;
    }

    function viewNumber() public view returns(uint256){
        return number;
    }
}
