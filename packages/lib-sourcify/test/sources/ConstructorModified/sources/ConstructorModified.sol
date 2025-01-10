pragma solidity >=0.8.0;

contract StorageConstructor {
    uint256 number;

    constructor(uint256 a) {
        number = a;
    }

    function read() public view returns (uint256) {
        return number;
    }
}

// Modifies the file
