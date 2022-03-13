pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface AccountInterface {
    function init(address index) external;
    function enable(address authority) external;
    function cast(address[] calldata _targets, bytes[] calldata _datas, address _origin) external payable returns (bytes32[] memory responses);
}

interface ListInterface {
    function init(address _account) external;
}

contract AddressIndex {
    address private newMaster;
    address public master;
    address public list;
    address public account;
    address public connectors;

    modifier isMaster() {
        require(msg.sender == master, "not-master");
        _;
    }

    function changeMaster(address _newMaster) external isMaster {
        require(_newMaster != master, "already-a-master");
        require(_newMaster != address(0), "not-valid-address");
        require(newMaster != _newMaster, "already-a-new-master");
        newMaster = _newMaster;
    }

    function updateMaster() external {
        require(newMaster != address(0), "not-valid-address");
        require(msg.sender == newMaster, "not-master");
        master = newMaster;
        newMaster = address(0);
    }
}

contract CloneFactory is AddressIndex {
    function createClone() internal returns (address result) {
        bytes20 targetBytes = bytes20(account);
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            result := create(0, clone, 0x37)
        }
    }

    function isClone(address query) external view returns (bool result) {
        bytes20 targetBytes = bytes20(account);
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x363d3d373d3d3d363d7300000000000000000000000000000000000000000000)
            mstore(add(clone, 0xa), targetBytes)
            mstore(add(clone, 0x1e), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)

            let other := add(clone, 0x40)
            extcodecopy(query, other, 0, 0x2d)
            result := and(
                eq(mload(clone), mload(other)),
                eq(mload(add(clone, 0xd)), mload(add(other, 0xd)))
            )
        }
    }
}

contract ZIndex is CloneFactory {
    event LogAccountCreated(address sender, address indexed owner, address indexed account, address indexed origin);

    function build(
        address _owner,
        address _origin
    ) public returns (address _account) {
        _account = createClone();
        ListInterface(list).init(_account);
        AccountInterface(_account).init(address(this));
        AccountInterface(_account).enable(_owner);
        emit LogAccountCreated(msg.sender, _owner, _account, _origin);
    }

    function setBasics(
        address _master,
        address _list,
        address _account,
        address _connectors
    ) external {
        require(
            master == address(0) &&
            list == address(0) &&
            account == address(0) &&
            connectors == address(0),
            "already-defined"
        );
        master = _master;
        list = _list;
        account = _account;
        connectors = _connectors;
    }
}