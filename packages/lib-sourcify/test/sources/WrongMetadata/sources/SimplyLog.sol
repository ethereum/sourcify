// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

/**
 * @notice Simply logs strings
 */
contract SimplyLog {
    /**
     * @notice The ID of the next message to be logged
     */
    uint256 public nextMessageId = 0;
    event Log(uint256 indexed messageId, string message);
    
    /**
     * @notice Log a message.
     * @param message Message to log
     * @return message id that was logged
     */
    function log(string calldata message) public returns (uint256) {
        uint256 messageId = nextMessageId;
        emit Log(messageId, message);
        nextMessageId += 1;
        return messageId;
    }
}
