// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

contract Proof {

    address public immutable proof;

    constructor (address _proof) {
        proof = _proof;
    }

    function retrieve( address _staker, uint _amount ) external returns(address) {
        return proof;
    }
}
