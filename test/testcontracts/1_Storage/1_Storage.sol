pragma solidity >=0.4.22 <0.7.0;

/**
 * @title Storage
 * @dev Store & retreive value in a variable
 */
contract Storage {

    uint256 numbera;

    /**
     * @dev Store value in variable
     * @param num value to store
     */
    function store(uint256 num) public {
        numbera = num;
    }

    /**
     * @dev Return value 
     * @return value of 'number'
     */
    function retreive() public view returns (uint256){
        return numbera;
    }
}