pragma solidity ^0.6.0;

import "./Import.sol";

/// @title A simple contract
/// @author Mary A. Botanist
/// @notice You can add one to a value, or subtract one.
/// @dev For testing source-verify
contract SimpleWithImport is Import {

    /// @author Mary A. Botanist
    /// @notice This function will add 1 to `_value`
    /// @dev For testing source-verify
    /// @param _value A number
    /// @return The number plus one
    function plusOne(uint _value) public pure returns (uint) {
        return _value + 1;
    }
}
