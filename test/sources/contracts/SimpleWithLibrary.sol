pragma solidity ^0.6.0;

import "./Library.sol";

/// @title A simple contract
/// @author Mary A. Botanist
/// @notice You can add one to a value.
/// @dev For testing source-verify
contract SimpleWithLibrary {

    /// @author Mary A. Botanist
    /// @notice This function will add 1 to `_value`
    /// @param _value A number
    /// @dev For testing source-verify
    /// @return The number plus one
    function plusOne(uint _value) public pure returns (uint) {
        return _value + 1;
    }

    /// @author Mary A. Botanist
    /// @notice This function will add 1 to `_value`
    /// @param _value A number
    /// @dev For testing source-verify
    /// @return The number plus twenty
    function plusTwenty(uint _value) public pure returns (uint) {
      return Library.plusTen(
        Library.plusTen(_value)
      );
    }
}