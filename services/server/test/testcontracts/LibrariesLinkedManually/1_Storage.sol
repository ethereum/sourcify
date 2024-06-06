// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

library Journal {
    function record(mapping(uint256 => uint256) storage journal, uint256 num) public {
        journal[block.number] = num;
    }
}

/**
 * @title Storage
 * @dev Store & retrieve value in a variable
 */
contract Storage {
    uint256 public number;

    mapping(uint256 => uint256) public journal;

    /**
     * @dev Store value in variable
     * @param num value to store
     */
    function store(uint256 num) public {
        number = num;
        Journal.record(journal, num);
    }
}