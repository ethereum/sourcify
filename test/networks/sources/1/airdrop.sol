pragma solidity ^0.8.0;

import "./IERC20.sol";

contract Airdrop  {
    
    address private owner;
    
    /**
     * @dev Sets the values for {owner} .
     * 
     */
    constructor () {
      owner = msg.sender;
    }
     
  /**
   * @dev daAirdrop to address
   * @param _tokenAddr address the erc20 token address
   * @param dests address[] addresses to airdrop
   * @param values uint256 value(in ether) to airdrop
   */
  function doAirdrop(address _tokenAddr, address[] memory dests, uint256 values)  public
    returns (uint256) {
    require(msg.sender==owner,'You do not have permission');
    uint256 i = 0;
    while (i < dests.length) {
      IERC20(_tokenAddr).transferFrom(msg.sender, dests[i], values);
      i += 1;
    }
    return(i);
  }

  function getOwner() public  view returns(address){
      return(owner);
  }
  
}