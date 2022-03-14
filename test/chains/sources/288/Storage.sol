// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.9;

contract Storage {
  uint256 number;

  /**
   * @dev Store value in variable
   * @param num value to store
   */
  function store(uint256 num) public {
    number = num;
  }

  /**
   * @dev Return value
   * @return value of 'number'
   */
  function retrieve() public view returns (uint256) {
    return number;
  }
}
