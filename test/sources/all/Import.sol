pragma solidity ^0.6.0;

/// @title A simple contract
/// @author Mary A. Botanist
/// @notice You can subtract one from a value.
/// @dev For testing source-verify
contract Import {

    /// @author Mary A. Botanist
    /// @notice This function will subtract 1 from `_value`
    /// @dev For testing source-verify
    /// @param _value A number
    /// @return The number minus one
    function minusOne(uint _value) public pure returns (uint) {
        return _value - 1;
    }
}
