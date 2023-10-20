pragma solidity >=0.7.0;

contract WithImmutables {
    uint256 public immutable _a;
    
    string _name;
    
    constructor (uint256 a) {
        _a = a;
    }
    
    function sign(string memory name) public {
        _name = name;
    }
    
    function read() public view returns(string memory) {
        return _name;
    }
}