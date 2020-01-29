pragma solidity ^0.6.0;

/// @title A simple library
/// @author Alexandra A. Alexandria
/// @notice You can add ten to a value.
/// @dev For testing source-verify
library Library {

    /// @author Alexandra A. Alexandria
    /// @notice This function will add 10 to `_value`
    /// @dev For testing source-verify
    /// @param _value A number
    /// @return The number plus 10
    function plusTen(uint _value) public pure returns (uint) {
        return _value + 1;
    }
}
