pragma solidity ^0.4.0;

contract MyLandContract {
    struct Land {
        address ownerAddress;
        string location;
        uint cost;
        uint landID;
    }
    address public owner; // government who creates the contract

    uint public totalLandsCounter; //total no of lands via this contract at any time

    //define who is owner
    function MyLandContract() public {
        owner = msg.sender;
        totalLandsCounter = 0;
    }

    //land addition event
    event Add(address _owner, uint _landID);

    //land transfer event
    event Transfer(address indexed _from, address indexed _to, uint _landID);

    modifier isOwner() {
        require(msg.sender == owner);
        _;
    }

    //one account can hold many lands (many landTokens, each token one land)
    mapping(address => Land[]) public __ownedLands;

    //1. FIRST OPERATION
    //owner shall add lands via this function
    function addLand(string _location, uint _cost) public isOwner {
        totalLandsCounter = totalLandsCounter + 1;
        Land memory myLand = Land({
            ownerAddress: msg.sender,
            location: _location,
            cost: _cost,
            landID: totalLandsCounter
        });
        __ownedLands[msg.sender].push(myLand);
        Add(msg.sender, totalLandsCounter);
    }

    //2. SECOND OPERATION
    //caller (owner/anyone) to transfer land to buyer provided caller is owner of the land
    function transferLand(
        address _landBuyer,
        uint _landID
    ) public returns (bool) {
        //find out the particular land ID in owner's collection
        for (uint i = 0; i < (__ownedLands[msg.sender].length); i++) {
            //if given land ID is indeed in owner's collection
            if (__ownedLands[msg.sender][i].landID == _landID) {
                //copy land in new owner's collection
                Land memory myLand = Land({
                    ownerAddress: _landBuyer,
                    location: __ownedLands[msg.sender][i].location,
                    cost: __ownedLands[msg.sender][i].cost,
                    landID: _landID
                });
                __ownedLands[_landBuyer].push(myLand);

                //remove land from current ownerAddress
                delete __ownedLands[msg.sender][i];

                //inform the world
                Transfer(msg.sender, _landBuyer, _landID);

                return true;
            }
        }

        //if we still did not return, return false
        return false;
    }

    //3. THIRD OPERATION
    //get land details of an account
    function getLand(
        address _landHolder,
        uint _index
    ) public returns (string, uint, address, uint) {
        return (
            __ownedLands[_landHolder][_index].location,
            __ownedLands[_landHolder][_index].cost,
            __ownedLands[_landHolder][_index].ownerAddress,
            __ownedLands[_landHolder][_index].landID
        );
    }

    //4. GET TOTAL NO OF LANDS OWNED BY AN ACCOUNT AS NO WAY TO RETURN STRUCT ARRAYS
    function getNoOfLands(address _landHolder) public returns (uint) {
        return __ownedLands[_landHolder].length;
    }
}
