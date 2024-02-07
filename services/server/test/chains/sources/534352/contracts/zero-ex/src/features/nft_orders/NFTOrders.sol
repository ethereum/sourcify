// SPDX-License-Identifier: Apache-2.0
/*

  Modifications Copyright 2022 Element.Market
  Copyright 2021 ZeroEx Intl.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../fixins/FixinEIP712.sol";
import "../../fixins/FixinTokenSpender.sol";
import "../../vendor/IEtherToken.sol";
import "../../vendor/IPropertyValidator.sol";
import "../../vendor/IFeeRecipient.sol";
import "../libs/LibSignature.sol";
import "../libs/LibNFTOrder.sol";
import "../libs/LibStructure.sol";


/// @dev Abstract base contract inherited by ERC721OrdersFeature and NFTOrders
abstract contract NFTOrders is FixinEIP712, FixinTokenSpender {

    using LibNFTOrder for LibNFTOrder.NFTBuyOrder;

    /// @dev Native token pseudo-address.
    address constant internal NATIVE_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    /// @dev The WETH token contract.
    IEtherToken internal immutable WETH;
    /// @dev The implementation address of this feature.
    address internal immutable _implementation;
    /// @dev The magic return value indicating the success of a `validateProperty`.
    bytes4 private constant PROPERTY_CALLBACK_MAGIC_BYTES = IPropertyValidator.validateProperty.selector;
    /// @dev The magic return value indicating the success of a `receiveZeroExFeeCallback`.
    bytes4 private constant FEE_CALLBACK_MAGIC_BYTES = IFeeRecipient.receiveZeroExFeeCallback.selector;

    constructor(IEtherToken weth) {
        require(address(weth) != address(0), "WETH_ADDRESS_ERROR");
        WETH = weth;
        // Remember this feature's original address.
        _implementation = address(this);
    }

    struct SellParams {
        uint128 sellAmount;
        uint256 tokenId;
        bool unwrapNativeToken;
        address taker;
        address currentNftOwner;
        bytes takerData;
    }

    // Core settlement logic for selling an NFT asset.
    function _sellNFT(
        LibNFTOrder.NFTBuyOrder memory buyOrder,
        LibSignature.Signature memory signature,
        LibNFTOrder.OrderInfoV2 memory orderInfo,
        SellParams memory params
    ) internal returns (uint256 erc20FillAmount) {
        // Check that the order can be filled.
        _validateBuyOrder(buyOrder, signature, orderInfo, params.taker, params.tokenId, params.sellAmount, params.takerData);

        // Calculate erc20 pay amount.
        erc20FillAmount = (params.sellAmount == orderInfo.orderAmount) ?
            buyOrder.erc20TokenAmount : buyOrder.erc20TokenAmount * params.sellAmount / orderInfo.orderAmount;

        if (params.unwrapNativeToken && buyOrder.erc20Token == WETH) {
            // Transfer the WETH from the maker to the Exchange Proxy
            // so we can unwrap it before sending it to the seller.
            _transferERC20TokensFrom(address(WETH), buyOrder.maker, address(this), erc20FillAmount);

            // Unwrap WETH into ETH.
            WETH.withdraw(erc20FillAmount);

            // Send ETH to the seller.
            _transferEth(payable(params.taker), erc20FillAmount);
        } else {
            // Transfer the ERC20 token from the buyer to the seller.
            _transferERC20TokensFrom(address(buyOrder.erc20Token), buyOrder.maker, params.taker, erc20FillAmount);
        }

        // Transfer the NFT asset to the buyer.
        // If this function is called from the
        // `onNFTReceived` callback the Exchange Proxy
        // holds the asset. Otherwise, transfer it from
        // the seller.
        _transferNFTAssetFrom(buyOrder.nft, params.currentNftOwner, buyOrder.maker, params.tokenId, params.sellAmount);

        // The buyer pays the order fees.
        _payFees(buyOrder.asNFTSellOrder(), buyOrder.maker, params.sellAmount, orderInfo.orderAmount, false);
    }

    // Core settlement logic for buying an NFT asset.
    function _buyNFT(
        LibNFTOrder.NFTSellOrder memory sellOrder,
        LibSignature.Signature memory signature,
        LibNFTOrder.OrderInfoV2 memory orderInfo,
        uint128 buyAmount,
        address taker,
        bytes memory takerData
    ) internal returns (uint256 erc20FillAmount) {
        // Check that the order can be filled.
        _validateSellOrder(sellOrder, signature, orderInfo, taker, buyAmount, takerData);

        // Dutch Auction
        if (sellOrder.expiry >> 252 == LibStructure.ORDER_KIND_DUTCH_AUCTION) {
            uint256 count = (sellOrder.expiry >> 64) & 0xffffffff;
            if (count > 0) {
                _resetDutchAuctionERC20AmountAndFees(sellOrder, count);
            }
        }

        // Calculate erc20 pay amount.
        erc20FillAmount = (buyAmount == orderInfo.orderAmount) ?
            sellOrder.erc20TokenAmount : _ceilDiv(sellOrder.erc20TokenAmount * buyAmount, orderInfo.orderAmount);

        // Transfer the NFT asset to the buyer.
        _transferNFTAssetFrom(sellOrder.nft, sellOrder.maker, taker, sellOrder.nftId, buyAmount);

        if (address(sellOrder.erc20Token) == NATIVE_TOKEN_ADDRESS) {
            // Transfer ETH to the seller.
            _transferEth(payable(sellOrder.maker), erc20FillAmount);

            // Fees are paid from the EP's current balance of ETH.
            _payFees(sellOrder, address(this), buyAmount, orderInfo.orderAmount, true);
        } else {
            // Transfer ERC20 token from the buyer to the seller.
            _transferERC20TokensFrom(address(sellOrder.erc20Token), msg.sender, sellOrder.maker, erc20FillAmount);

            // The buyer pays fees.
            _payFees(sellOrder, msg.sender, buyAmount, orderInfo.orderAmount, false);
        }
    }

    function _validateSellOrder(
        LibNFTOrder.NFTSellOrder memory sellOrder,
        LibSignature.Signature memory signature,
        LibNFTOrder.OrderInfoV2 memory orderInfo,
        address taker,
        uint128 buyAmount,
        bytes memory takerData
    ) internal {
        // Taker must match the order taker, if one is specified.
        require(sellOrder.taker == address(0) || sellOrder.taker == taker, "_validateOrder/ONLY_TAKER");

        // Check that the order is valid and has not expired, been cancelled,
        // or been filled.
        require(orderInfo.status == LibNFTOrder.OrderStatus.FILLABLE, "_validateOrder/ORDER_NOT_FILL");

        // Check amount.
        require(buyAmount <= orderInfo.remainingAmount, "_validateOrder/EXCEEDS_REMAINING_AMOUNT");

        // Update the order state.
        _updateOrderState(sellOrder, orderInfo.orderHash, buyAmount);

        // Check the signature.
        if (
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK ||
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK_1271
        ) {
            (bytes32 validateHash, ) = _getBulkValidateHashAndExtraData(false, orderInfo.structHash, takerData);
            _validateOrderSignature(validateHash, signature, sellOrder.maker);
        } else {
            _validateOrderSignature(orderInfo.orderHash, signature, sellOrder.maker);
        }
    }

    function _validateBuyOrder(
        LibNFTOrder.NFTBuyOrder memory buyOrder,
        LibSignature.Signature memory signature,
        LibNFTOrder.OrderInfoV2 memory orderInfo,
        address taker,
        uint256 tokenId,
        uint128 sellAmount,
        bytes memory takerData
    ) internal {
        // The ERC20 token cannot be ETH.
        require(address(buyOrder.erc20Token) != NATIVE_TOKEN_ADDRESS, "_validateOrder/TOKEN_MISMATCH");

        // Taker must match the order taker, if one is specified.
        require(buyOrder.taker == address(0) || buyOrder.taker == taker, "_validateOrder/ONLY_TAKER");

        // Check that the order is valid and has not expired, been cancelled,
        // or been filled.
        require(orderInfo.status == LibNFTOrder.OrderStatus.FILLABLE, "_validateOrder/ORDER_NOT_FILL");

        // Check amount.
        require(sellAmount <= orderInfo.remainingAmount, "_validateOrder/EXCEEDS_REMAINING_AMOUNT");

        // Update the order state.
        _updateOrderState(buyOrder, orderInfo.orderHash, sellAmount);

        if (
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK ||
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK_1271
        ) {
            (bytes32 validateHash, bytes memory extraData) = _getBulkValidateHashAndExtraData(true, orderInfo.structHash, takerData);

            // Validate properties.
            _validateOrderProperties(buyOrder, orderInfo.orderHash, tokenId, extraData);

            // Check the signature.
            _validateOrderSignature(validateHash, signature, buyOrder.maker);
        } else {
            // Validate properties.
            _validateOrderProperties(buyOrder, orderInfo.orderHash, tokenId, takerData);

            // Check the signature.
            _validateOrderSignature(orderInfo.orderHash, signature, buyOrder.maker);
        }
    }

    function _resetDutchAuctionERC20AmountAndFees(LibNFTOrder.NFTSellOrder memory order, uint256 count) internal view {
        require(count <= 100000000, "COUNT_OUT_OF_SIDE");

        uint256 listingTime = (order.expiry >> 32) & 0xffffffff;
        uint256 denominator = ((order.expiry & 0xffffffff) - listingTime) * 100000000;
        uint256 multiplier = (block.timestamp - listingTime) * count;

        // Reset erc20TokenAmount
        uint256 amount = order.erc20TokenAmount;
        order.erc20TokenAmount = amount - amount * multiplier / denominator;

        // Reset fees
        for (uint256 i = 0; i < order.fees.length; i++) {
            amount = order.fees[i].amount;
            order.fees[i].amount = amount - amount * multiplier / denominator;
        }
    }

    function _resetEnglishAuctionERC20AmountAndFees(
        LibNFTOrder.NFTSellOrder memory sellOrder,
        uint256 buyERC20Amount,
        uint256 fillAmount,
        uint256 orderAmount
    ) internal pure {
        uint256 sellOrderFees = _calcTotalFeesPaid(sellOrder.fees, fillAmount, orderAmount);
        uint256 sellTotalAmount = sellOrderFees + sellOrder.erc20TokenAmount;
        if (buyERC20Amount != sellTotalAmount) {
            uint256 spread = buyERC20Amount - sellTotalAmount;
            uint256 sum;

            // Reset fees
            if (sellTotalAmount > 0) {
                for (uint256 i = 0; i < sellOrder.fees.length; i++) {
                    uint256 diff = spread * sellOrder.fees[i].amount / sellTotalAmount;
                    sellOrder.fees[i].amount += diff;
                    sum += diff;
                }
            }

            // Reset erc20TokenAmount
            sellOrder.erc20TokenAmount += spread - sum;
        }
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        // ceil(a / b) = floor((a + b - 1) / b)
        return (a + b - 1) / b;
    }

    function _calcTotalFeesPaid(LibNFTOrder.Fee[] memory fees, uint256 fillAmount, uint256 orderAmount) private pure returns (uint256 totalFeesPaid) {
        if (fillAmount == orderAmount) {
            for (uint256 i = 0; i < fees.length; i++) {
                totalFeesPaid += fees[i].amount;
            }
        } else {
            for (uint256 i = 0; i < fees.length; i++) {
                totalFeesPaid += fees[i].amount * fillAmount / orderAmount;
            }
        }
        return totalFeesPaid;
    }

    function _payFees(
        LibNFTOrder.NFTSellOrder memory order,
        address payer,
        uint128 fillAmount,
        uint128 orderAmount,
        bool useNativeToken
    ) internal returns (uint256 totalFeesPaid) {
        for (uint256 i; i < order.fees.length; ) {
            LibNFTOrder.Fee memory fee = order.fees[i];

            uint256 feeFillAmount = (fillAmount == orderAmount) ? fee.amount : fee.amount * fillAmount / orderAmount;

            if (useNativeToken) {
                // Transfer ETH to the fee recipient.
                _transferEth(payable(fee.recipient), feeFillAmount);
            } else {
                if (feeFillAmount > 0) {
                    // Transfer ERC20 token from payer to recipient.
                    _transferERC20TokensFrom(address(order.erc20Token), payer, fee.recipient, feeFillAmount);
                }
            }

            // Note that the fee callback is _not_ called if zero
            // `feeData` is provided. If `feeData` is provided, we assume
            // the fee recipient is a contract that implements the
            // `IFeeRecipient` interface.
            if (fee.feeData.length > 0) {
                require(fee.recipient.code.length != 0, "_payFees/INVALID_FEE_RECIPIENT");

                // Invoke the callback
                bytes4 callbackResult = IFeeRecipient(fee.recipient).receiveZeroExFeeCallback(
                    useNativeToken ? NATIVE_TOKEN_ADDRESS : address(order.erc20Token),
                    feeFillAmount,
                    fee.feeData
                );

                // Check for the magic success bytes
                require(callbackResult == FEE_CALLBACK_MAGIC_BYTES, "_payFees/CALLBACK_FAILED");
            }

            // Sum the fees paid
            totalFeesPaid += feeFillAmount;
            unchecked { i++; }
        }
        return totalFeesPaid;
    }

    function _validateOrderProperties(
        LibNFTOrder.NFTBuyOrder memory order,
        bytes32 orderHash,
        uint256 tokenId,
        bytes memory data
    ) internal view {
        // If no properties are specified, check that the given
        // `tokenId` matches the one specified in the order.
        if (order.nftProperties.length == 0) {
            require(tokenId == order.nftId, "_validateProperties/TOKEN_ID_ERR");
        } else {
            // Validate each property
            for (uint256 i; i < order.nftProperties.length; ) {
                LibNFTOrder.Property memory property = order.nftProperties[i];
                // `address(0)` is interpreted as a no-op. Any token ID
                // will satisfy a property with `propertyValidator == address(0)`.
                if (address(property.propertyValidator) != address(0)) {
                    require(address(property.propertyValidator).code.length != 0, "INVALID_PROPERTY_VALIDATOR");

                    // Call the property validator and throw a descriptive error
                    // if the call reverts.
                    bytes4 result = property.propertyValidator.validateProperty(
                        order.nft, tokenId, orderHash, property.propertyData, data
                    );

                    // Check for the magic success bytes
                    require(result == PROPERTY_CALLBACK_MAGIC_BYTES, "PROPERTY_VALIDATION_FAILED");
                }
                unchecked { i++; }
            }
        }
    }

    function _getBulkValidateHashAndExtraData(
        bool isBuyOrder,
        bytes32 leaf,
        bytes memory takerData
    ) internal view returns(
        bytes32 validateHash,
        bytes memory data
    ) {
        uint256 proofsLength;
        bytes32 root = leaf;
        assembly {
            // takerData = 32bytes[length] + 32bytes[head] + [proofsData] + [data]
            let ptrHead := add(takerData, 0x20)

            // head = 4bytes[dataLength] + 1bytes[proofsLength] + 24bytes[unused] + 3bytes[proofsKey]
            let head := mload(ptrHead)
            let dataLength := shr(224, head)
            proofsLength := byte(4, head)
            let proofsKey := and(head, 0xffffff)

            // require(proofsLength != 0)
            if iszero(proofsLength) {
                _revertTakerDataError()
            }

            // require(32 + proofsLength * 32 + dataLength == takerData.length)
            if iszero(eq(add(0x20, add(shl(5, proofsLength), dataLength)), mload(takerData))) {
                _revertTakerDataError()
            }

            // Compute remaining proofs.
            let ptrAfterHead := add(ptrHead, 0x20)
            let ptrProofNode := ptrAfterHead

            for { let i } lt(i, proofsLength) { i := add(i, 1) } {
                // Check if the current bit of the key is set.
                switch and(shr(i, proofsKey), 0x1)
                case 0 {
                    mstore(ptrHead, root)
                    mstore(ptrAfterHead, mload(ptrProofNode))
                }
                case 1 {
                    mstore(ptrHead, mload(ptrProofNode))
                    mstore(ptrAfterHead, root)
                }

                root := keccak256(ptrHead, 0x40)
                ptrProofNode := add(ptrProofNode, 0x20)
            }

            data := sub(ptrProofNode, 0x20)
            mstore(data, dataLength)

            function _revertTakerDataError() {
                // revert("TakerData error")
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(0x40, 0x0000000f54616b657244617461206572726f7200000000000000000000000000)
                mstore(0x60, 0)
                revert(0, 0x64)
            }
        }

        if (isBuyOrder) {
            validateHash = _getEIP712Hash(
                keccak256(abi.encode(_getBulkBuyOrderTypeHash(proofsLength), root))
            );
        } else {
            validateHash = _getEIP712Hash(
                keccak256(abi.encode(_getBulkSellOrderTypeHash(proofsLength), root))
            );
        }
        return (validateHash, data);
    }

    function _isOrderPreSigned(bytes32 orderHash, address maker) internal virtual view returns(bool);

    function _validateOrderSignature(
        bytes32 hash, LibSignature.Signature memory signature, address maker
    ) internal view {
        if (
            signature.signatureType == LibSignature.SignatureType.EIP712 ||
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK
        ) {
            require(maker != address(0), "INVALID_SIGNER");
            require(maker == ecrecover(hash, signature.v, signature.r, signature.s), "INVALID_SIGNATURE");
        } else if (
            signature.signatureType == LibSignature.SignatureType.EIP712_1271 ||
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK_1271
        ) {
            uint256 v = signature.v;
            bytes32 r = signature.r;
            bytes32 s = signature.s;
            assembly {
                let ptr := mload(0x40) // free memory pointer

                // selector for `isValidSignature(bytes32,bytes)`
                mstore(ptr, 0x1626ba7e)
                mstore(add(ptr, 0x20), hash)
                mstore(add(ptr, 0x40), 0x40)
                mstore(add(ptr, 0x60), 0x41)
                mstore(add(ptr, 0x80), r)
                mstore(add(ptr, 0xa0), s)
                mstore(add(ptr, 0xc0), shl(248, v))

                if iszero(extcodesize(maker)) {
                    _revertInvalidSigner()
                }

                // Call signer with `isValidSignature` to validate signature.
                if iszero(staticcall(gas(), maker, add(ptr, 0x1c), 0xa5, ptr, 0x20)) {
                    _revertInvalidSignature()
                }

                // Check for returnData.
                if iszero(eq(mload(ptr), 0x1626ba7e00000000000000000000000000000000000000000000000000000000)) {
                    _revertInvalidSignature()
                }

                function _revertInvalidSigner() {
                    // revert("INVALID_SIGNER")
                    mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                    mstore(0x40, 0x0000000e494e56414c49445f5349474e45520000000000000000000000000000)
                    mstore(0x60, 0)
                    revert(0, 0x64)
                }

                function _revertInvalidSignature() {
                    // revert("INVALID_SIGNATURE")
                    mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                    mstore(0x40, 0x00000011494e56414c49445f5349474e41545552450000000000000000000000)
                    mstore(0x60, 0)
                    revert(0, 0x64)
                }
            }
        } else if (signature.signatureType == LibSignature.SignatureType.PRESIGNED) {
            require(maker != address(0), "INVALID_SIGNER");
            require(_isOrderPreSigned(hash, maker), "PRESIGNED_INVALID_SIGNER");
        } else {
            revert("INVALID_SIGNATURE_TYPE");
        }
    }

    /// @dev Transfers an NFT asset.
    /// @param token The address of the NFT contract.
    /// @param from The address currently holding the asset.
    /// @param to The address to transfer the asset to.
    /// @param tokenId The ID of the asset to transfer.
    /// @param amount The amount of the asset to transfer. Always
    ///        1 for ERC721 assets.
    function _transferNFTAssetFrom(address token, address from, address to, uint256 tokenId, uint256 amount) internal virtual;

    /// @dev Updates storage to indicate that the given order
    ///      has been filled by the given amount.
    /// @param order The order that has been filled.
    /// @param orderHash The hash of `order`.
    /// @param fillAmount The amount (denominated in the NFT asset)
    ///        that the order has been filled by.
    function _updateOrderState(LibNFTOrder.NFTSellOrder memory order, bytes32 orderHash, uint128 fillAmount) internal virtual;

    /// @dev Updates storage to indicate that the given order
    ///      has been filled by the given amount.
    /// @param order The order that has been filled.
    /// @param orderHash The hash of `order`.
    /// @param fillAmount The amount (denominated in the NFT asset)
    ///        that the order has been filled by.
    function _updateOrderState(LibNFTOrder.NFTBuyOrder memory order, bytes32 orderHash, uint128 fillAmount) internal virtual;

    function _getBulkBuyOrderTypeHash(uint256 height) internal virtual pure returns (bytes32);

    function _getBulkSellOrderTypeHash(uint256 height) internal virtual pure returns (bytes32);
}
