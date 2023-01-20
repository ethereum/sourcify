// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract Factory2{
     Child2[] public children;
     uint disabledCount;

    event ChildCreated(address childAddress);

     function createChild() external{
       Child2 child = new Child2();
       children.push(child);
       emit ChildCreated(address(child));
     }

     function getChildren() external view returns(Child2[] memory _children){
       _children = new Child2[](children.length- disabledCount);
       uint count;
       for(uint i=0;i<children.length; i++){
            _children[count] = children[i];
            count++;
         }
     }  

 
}
contract Child2{
    address immutable public owner;
    constructor(){
       owner = msg.sender;
    }
}