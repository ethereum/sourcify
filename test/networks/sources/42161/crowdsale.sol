// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.4;

/// @notice Safe ETH and ERC-20 transfer library that gracefully handles missing return values.
/// @author Modified from SolMate (https://github.com/Rari-Capital/solmate/blob/main/src/utils/SafeTransferLib.sol)
/// License-Identifier: AGPL-3.0-only
/// @dev Use with caution! Some functions in this library knowingly create dirty bits at the destination of the free memory pointer.
library SafeTransferLib {
    /*///////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error ETHtransferFailed();

    error TransferFailed();

    error TransferFromFailed();

    /*///////////////////////////////////////////////////////////////
                            ETH OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function _safeTransferETH(address to, uint256 amount) internal {
        bool callStatus;

        assembly {
            // transfer the ETH and store if it succeeded or not
            callStatus := call(gas(), to, amount, 0, 0, 0, 0)
        }

        if (!callStatus) revert ETHtransferFailed();
    }

    /*///////////////////////////////////////////////////////////////
                            ERC20 OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function _safeTransfer(
        address token,
        address to,
        uint256 amount
    ) internal {
        bool callStatus;

        assembly {
            // get a pointer to some free memory
            let freeMemoryPointer := mload(0x40)

            // write the abi-encoded calldata to memory piece by piece:
            mstore(freeMemoryPointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000) // begin with the function selector
            
            mstore(add(freeMemoryPointer, 4), and(to, 0xffffffffffffffffffffffffffffffffffffffff)) // mask and append the "to" argument
            
            mstore(add(freeMemoryPointer, 36), amount) // finally append the "amount" argument - no mask as it's a full 32 byte value

            // call the token and store if it succeeded or not
            // we use 68 because the calldata length is 4 + 32 * 2
            callStatus := call(gas(), token, 0, freeMemoryPointer, 68, 0, 0)
        }

        if (!_didLastOptionalReturnCallSucceed(callStatus)) revert TransferFailed();
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        bool callStatus;

        assembly {
            // get a pointer to some free memory
            let freeMemoryPointer := mload(0x40)

            // write the abi-encoded calldata to memory piece by piece:
            mstore(freeMemoryPointer, 0x23b872dd00000000000000000000000000000000000000000000000000000000) // begin with the function selector
            
            mstore(add(freeMemoryPointer, 4), and(from, 0xffffffffffffffffffffffffffffffffffffffff)) // mask and append the "from" argument
            
            mstore(add(freeMemoryPointer, 36), and(to, 0xffffffffffffffffffffffffffffffffffffffff)) // mask and append the "to" argument
            
            mstore(add(freeMemoryPointer, 68), amount) // finally append the "amount" argument - no mask as it's a full 32 byte value

            // call the token and store if it succeeded or not
            // we use 100 because the calldata length is 4 + 32 * 3
            callStatus := call(gas(), token, 0, freeMemoryPointer, 100, 0, 0)
        }

        if (!_didLastOptionalReturnCallSucceed(callStatus)) revert TransferFromFailed();
    }

    /*///////////////////////////////////////////////////////////////
                            INTERNAL HELPER LOGIC
    //////////////////////////////////////////////////////////////*/

    function _didLastOptionalReturnCallSucceed(bool callStatus) internal pure returns (bool success) {
        assembly {
            // get how many bytes the call returned
            let returnDataSize := returndatasize()

            // if the call reverted:
            if iszero(callStatus) {
                // copy the revert message into memory
                returndatacopy(0, 0, returnDataSize)

                // revert with the same message
                revert(0, returnDataSize)
            }

            switch returnDataSize
            
            case 32 {
                // copy the return data into memory
                returndatacopy(0, 0, returnDataSize)

                // set success to whether it returned true
                success := iszero(iszero(mload(0)))
            }
            case 0 {
                // there was no return data
                success := 1
            }
            default {
                // it returned some malformed input
                success := 0
            }
        }
    }
}

/// @notice Kali DAO access manager interface.
interface IKaliAccessManager {
    function listedAccounts(uint256 listId, address account) external returns (bool);

    function joinList(
        uint256 listId,
        address account,
        bytes32[] calldata merkleProof
    ) external;
}

/// @notice Kali DAO share manager interface.
interface IKaliShareManager {
    function mintShares(address to, uint256 amount) external;

    function burnShares(address from, uint256 amount) external;
}

/// @notice EIP-2612 interface.
interface IERC20Permit {
    function permit(
        address owner, 
        address spender, 
        uint256 value, 
        uint256 deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) external;
}

/// @notice Helper utility that enables calling multiple local methods in a single call.
/// @author Modified from Uniswap (https://github.com/Uniswap/v3-periphery/blob/main/contracts/base/Multicall.sol)
abstract contract Multicall {
    function multicall(bytes[] calldata data) public virtual returns (bytes[] memory results) {
        results = new bytes[](data.length);
        
        // cannot realistically overflow on human timescales
        unchecked {
            for (uint256 i = 0; i < data.length; i++) {
                (bool success, bytes memory result) = address(this).delegatecall(data[i]);

                if (!success) {
                    if (result.length < 68) revert();
                    
                    assembly {
                        result := add(result, 0x04)
                    }
                    
                    revert(abi.decode(result, (string)));
                }
                results[i] = result;
            }
        }
    }
}

/// @notice Gas-optimized reentrancy protection.
/// @author Modified from OpenZeppelin 
/// (https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/security/ReentrancyGuard.sol)
/// License-Identifier: MIT
abstract contract ReentrancyGuard {
    error Reentrancy();

    uint256 private constant NOT_ENTERED = 1;

    uint256 private constant ENTERED = 2;

    uint256 private status = NOT_ENTERED;

    modifier nonReentrant() {
        if (status == ENTERED) revert Reentrancy();

        status = ENTERED;

        _;

        status = NOT_ENTERED;
    }
}

/// @notice Crowdsale contract that receives ETH or ERC-20 to mint registered DAO tokens, including merkle access lists.
contract KaliDAOcrowdsale is Multicall, ReentrancyGuard {
    using SafeTransferLib for address;

    event ExtensionSet(
        address indexed dao, 
        uint256 listId, 
        address purchaseToken, 
        uint8 purchaseMultiplier, 
        uint96 purchaseLimit, 
        uint32 saleEnds, 
        string details
    );

    event ExtensionCalled(address indexed dao, address indexed purchaser, uint256 amountOut);

    error NullMultiplier();

    error SaleEnded();

    error NotListed();

    error PurchaseLimit();
    
    IKaliAccessManager private immutable accessManager;

    address private immutable wETH;

    mapping(address => Crowdsale) public crowdsales;

    struct Crowdsale {
        uint256 listId;
        address purchaseToken;
        uint8 purchaseMultiplier;
        uint96 purchaseLimit;
        uint96 amountPurchased;
        uint32 saleEnds;
        string details;
    }

    constructor(IKaliAccessManager accessManager_, address wETH_) {
        accessManager = accessManager_;

        wETH = wETH_;
    }

    function setExtension(bytes calldata extensionData) public nonReentrant virtual {
        (uint256 listId, address purchaseToken, uint8 purchaseMultiplier, uint96 purchaseLimit, uint32 saleEnds, string memory details) 
            = abi.decode(extensionData, (uint256, address, uint8, uint96, uint32, string));
        
        if (purchaseMultiplier == 0) revert NullMultiplier();

        crowdsales[msg.sender] = Crowdsale({
            listId: listId,
            purchaseToken: purchaseToken,
            purchaseMultiplier: purchaseMultiplier,
            purchaseLimit: purchaseLimit,
            amountPurchased: 0,
            saleEnds: saleEnds,
            details: details
        });

        emit ExtensionSet(msg.sender, listId, purchaseToken, purchaseMultiplier, purchaseLimit, saleEnds, details);
    }

    function joinList(uint256 listId, bytes32[] calldata merkleProof) public virtual {
        accessManager.joinList(
            listId,
            msg.sender,
            merkleProof
        );
    }

    function setPermit(
        IERC20Permit token, 
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r, 
        bytes32 s
    ) public virtual {
        token.permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
    }

    function callExtension(address dao, uint256 amount) public payable nonReentrant virtual returns (uint256 amountOut) {
        Crowdsale storage sale = crowdsales[dao];

        if (block.timestamp > sale.saleEnds) revert SaleEnded();

        if (sale.listId != 0) 
            if (!accessManager.listedAccounts(sale.listId, msg.sender)) revert NotListed();

        if (sale.purchaseToken == address(0)) {
            amountOut = msg.value * sale.purchaseMultiplier;

            if (sale.amountPurchased + amountOut > sale.purchaseLimit) revert PurchaseLimit();

            // send ETH to DAO
            dao._safeTransferETH(msg.value);

            sale.amountPurchased += uint96(amountOut);

            IKaliShareManager(dao).mintShares(msg.sender, amountOut);
        } else if (sale.purchaseToken == address(0xDead)) {
            amountOut = msg.value * sale.purchaseMultiplier;

            if (sale.amountPurchased + amountOut > sale.purchaseLimit) revert PurchaseLimit();

            // send ETH to wETH
            wETH._safeTransferETH(msg.value);

            // send wETH to DAO
            wETH._safeTransfer(dao, msg.value);

            sale.amountPurchased += uint96(amountOut);

            IKaliShareManager(dao).mintShares(msg.sender, amountOut);
        } else {
            // send tokens to DAO
            sale.purchaseToken._safeTransferFrom(msg.sender, dao, amount);

            amountOut = amount * sale.purchaseMultiplier;

            if (sale.amountPurchased + amountOut > sale.purchaseLimit) revert PurchaseLimit();

            sale.amountPurchased += uint96(amountOut);
            
            IKaliShareManager(dao).mintShares(msg.sender, amountOut);
        }

        emit ExtensionCalled(dao, msg.sender, amountOut);
    }
}