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

import "../../fixins/FixinERC1155Spender.sol";
import "../../storage/LibCommonNftOrdersStorage.sol";
import "../../storage/LibERC1155OrdersStorage.sol";
import "../interfaces/IERC1155OrdersFeature.sol";
import "../libs/LibNFTOrder.sol";
import "../libs/LibSignature.sol";
import "../libs/LibTypeHash.sol";
import "../libs/LibMultiCall.sol";
import "./NFTOrders.sol";


/// @dev Feature for interacting with ERC1155 orders.
contract ERC1155OrdersFeature is
    IERC1155OrdersFeature,
    FixinERC1155Spender,
    NFTOrders
{
    using LibNFTOrder for LibNFTOrder.ERC1155SellOrder;
    using LibNFTOrder for LibNFTOrder.ERC1155BuyOrder;
    using LibNFTOrder for LibNFTOrder.NFTSellOrder;
    using LibNFTOrder for LibNFTOrder.NFTBuyOrder;

    /// @dev The magic return value indicating the success of a `onERC1155Received`.
    bytes4 private constant ERC1155_RECEIVED_MAGIC_BYTES = this.onERC1155Received.selector;
    bytes4 private constant SELL_ERC1155_SELECTOR = this.sellERC1155.selector;

    uint256 private constant ORDER_NONCE_MASK = (1 << 184) - 1;

    constructor(IEtherToken weth) NFTOrders(weth) {
    }

    /// @dev Sells an ERC1155 asset to fill the given order.
    /// @param buyOrder The ERC1155 buy order.
    /// @param signature The order signature from the maker.
    /// @param erc1155TokenId The ID of the ERC1155 asset being
    ///        sold. If the given order specifies properties,
    ///        the asset must satisfy those properties. Otherwise,
    ///        it must equal the tokenId in the order.
    /// @param erc1155SellAmount The amount of the ERC1155 asset
    ///        to sell.
    /// @param unwrapNativeToken If this parameter is true and the
    ///        ERC20 token of the order is e.g. WETH, unwraps the
    ///        token before transferring it to the taker.
    function sellERC1155(
        LibNFTOrder.ERC1155BuyOrder memory buyOrder,
        LibSignature.Signature memory signature,
        uint256 erc1155TokenId,
        uint128 erc1155SellAmount,
        bool unwrapNativeToken,
        bytes memory takerData
    ) external override {
        _sellERC1155(
            buyOrder,
            signature,
            SellParams(
                erc1155SellAmount,
                erc1155TokenId,
                unwrapNativeToken,
                msg.sender, // taker
                msg.sender, // owner
                takerData
            ),
            true
        );
    }

    function sellERC1155NotSupportedPartialSell(
        LibNFTOrder.ERC1155BuyOrder memory buyOrder,
        LibSignature.Signature memory signature,
        uint256 erc1155TokenId,
        uint128 erc1155SellAmount,
        bool unwrapNativeToken,
        bytes memory takerData
    ) external {
        _sellERC1155(
            buyOrder,
            signature,
            SellParams(
                erc1155SellAmount,
                erc1155TokenId,
                unwrapNativeToken,
                msg.sender, // taker
                msg.sender, // owner
                takerData
            ),
            false
        );
    }

    function batchSellERC1155s(bytes[] calldata datas, bool revertIfIncomplete) external override {
        bytes4 targetSelector = revertIfIncomplete ?
            this.sellERC1155NotSupportedPartialSell.selector :
            SELL_ERC1155_SELECTOR;
        LibMultiCall._multiCall(
            _implementation,
            targetSelector,
            SELL_ERC1155_SELECTOR,
            datas,
            revertIfIncomplete
        );
    }

    function buyERC1155Ex(
        LibNFTOrder.ERC1155SellOrder memory sellOrder,
        LibSignature.Signature memory signature,
        address taker,
        uint128 erc1155BuyAmount,
        bytes memory takerData
    ) external override payable {
        uint256 ethBalanceBefore = address(this).balance - msg.value;

        _buyERC1155(sellOrder, signature, erc1155BuyAmount, taker, takerData, true);

        // Refund
        if (address(this).balance != ethBalanceBefore) {
            _transferEth(payable(msg.sender), address(this).balance - ethBalanceBefore);
        }
    }

    /// @dev Cancel a single ERC1155 order by its nonce. The caller
    ///      should be the maker of the order. Silently succeeds if
    ///      an order with the same nonce has already been filled or
    ///      cancelled.
    /// @param orderNonce The order nonce.
    function cancelERC1155Order(uint256 orderNonce) public override {
        // The bitvector is indexed by the lower 8 bits of the nonce.
        uint256 flag = 1 << (orderNonce & 255);
        // Update order cancellation bit vector to indicate that the order
        // has been cancelled/filled by setting the designated bit to 1.
        LibERC1155OrdersStorage.getStorage().orderCancellationByMaker
            [msg.sender][uint248((orderNonce >> 8) & ORDER_NONCE_MASK)] |= flag;

        emit ERC1155OrderCancelled(msg.sender, orderNonce);
    }

    /// @dev Cancel multiple ERC1155 orders by their nonces. The caller
    ///      should be the maker of the orders. Silently succeeds if
    ///      an order with the same nonce has already been filled or
    ///      cancelled.
    /// @param orderNonces The order nonces.
    function batchCancelERC1155Orders(uint256[] calldata orderNonces) external override {
        for (uint256 i = 0; i < orderNonces.length; i++) {
            cancelERC1155Order(orderNonces[i]);
        }
    }

    function batchBuyERC1155sEx(
        LibNFTOrder.ERC1155SellOrder[] memory sellOrders,
        LibSignature.Signature[] memory signatures,
        address[] calldata takers,
        uint128[] calldata erc1155FillAmounts,
        bytes[] memory takerDatas,
        bool revertIfIncomplete
    ) external override payable returns (bool[] memory successes) {
        uint256 length = sellOrders.length;
        require(
            length == signatures.length &&
            length == takers.length &&
            length == erc1155FillAmounts.length &&
            length == takerDatas.length,
            "ARRAY_LENGTH_MISMATCH"
        );

        successes = new bool[](length);
        uint256 ethBalanceBefore = address(this).balance - msg.value;

        bool someSuccess = false;
        if (revertIfIncomplete) {
            for (uint256 i; i < length; ) {
                // Will revert if _buyERC1155 reverts.
                _buyERC1155(sellOrders[i], signatures[i], erc1155FillAmounts[i], takers[i], takerDatas[i], false);
                successes[i] = true;
                someSuccess = true;
                unchecked { i++; }
            }
        } else {
            for (uint256 i; i < length; ) {
                // Delegatecall `buyERC1155FromProxy` to catch swallow reverts while
                // preserving execution context.
                (successes[i], ) = _implementation.delegatecall(
                    abi.encodeWithSelector(
                        this.buyERC1155FromProxy.selector,
                        sellOrders[i],
                        signatures[i],
                        erc1155FillAmounts[i],
                        takers[i],
                        takerDatas[i]
                    )
                );
                if (successes[i]) {
                    someSuccess = true;
                }
                unchecked { i++; }
            }
        }
        require(someSuccess, "batchBuyERC1155sEx/NO_ORDER_FILLED");

        // Refund
       _transferEth(payable(msg.sender), address(this).balance - ethBalanceBefore);
    }

    // @Note `buyERC1155FromProxy` is a external function, must call from an external Exchange Proxy,
    //        but should not be registered in the Exchange Proxy.
    function buyERC1155FromProxy(
        LibNFTOrder.ERC1155SellOrder memory sellOrder,
        LibSignature.Signature memory signature,
        uint128 buyAmount,
        address taker,
        bytes memory takerData
    ) external payable {
        require(_implementation != address(this), "MUST_CALL_FROM_PROXY");
        _buyERC1155(sellOrder, signature, buyAmount, taker, takerData, true);
    }

    /// @dev Callback for the ERC1155 `safeTransferFrom` function.
    ///      This callback can be used to sell an ERC1155 asset if
    ///      a valid ERC1155 order, signature and `unwrapNativeToken`
    ///      are encoded in `data`. This allows takers to sell their
    ///      ERC1155 asset without first calling `setApprovalForAll`.
    /// @param operator The address which called `safeTransferFrom`.
    /// @param tokenId The ID of the asset being transferred.
    /// @param value The amount being transferred.
    /// @param data Additional data with no specified format. If a
    ///        valid ERC1155 order, signature and `unwrapNativeToken`
    ///        are encoded in `data`, this function will try to fill
    ///        the order using the received asset.
    /// @return success The selector of this function (0xf23a6e61),
    ///         indicating that the callback succeeded.
    function onERC1155Received(
        address operator,
        address /* from */,
        uint256 tokenId,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4 success) {
        // Decode the order, signature, and `unwrapNativeToken` from
        // `data`. If `data` does not encode such parameters, this
        // will throw.
        (
            LibNFTOrder.ERC1155BuyOrder memory buyOrder,
            LibSignature.Signature memory signature,
            bool unwrapNativeToken,
            bytes memory takerData
        ) = abi.decode(
            data,
            (LibNFTOrder.ERC1155BuyOrder, LibSignature.Signature, bool, bytes)
        );

        // `onERC1155Received` is called by the ERC1155 token contract.
        // Check that it matches the ERC1155 token in the order.
        require(msg.sender == buyOrder.erc1155Token, "ERC1155_TOKEN_MISMATCH_ERROR");
        require(value <= type(uint128).max, "ERC1155_VALUE_OVERFLOW");

        _sellERC1155(
            buyOrder,
            signature,
            SellParams(
                uint128(value),
                tokenId,
                unwrapNativeToken,
                operator,       // taker
                address(this),  // owner (we hold the NFT currently)
                takerData
            ),
            false
        );

        return ERC1155_RECEIVED_MAGIC_BYTES;
    }

    /// @dev Approves an ERC1155 sell order on-chain. After pre-signing
    ///      the order, the `PRESIGNED` signature type will become
    ///      valid for that order and signer.
    /// @param order An ERC1155 sell order.
    function preSignERC1155SellOrder(LibNFTOrder.ERC1155SellOrder memory order) external override {
        require(order.maker == msg.sender, "ONLY_MAKER");

        uint256 hashNonce = LibCommonNftOrdersStorage.getStorage().hashNonces[order.maker];
        require(hashNonce < type(uint128).max);

        bytes32 orderHash = getERC1155SellOrderHash(order);
        LibERC1155OrdersStorage.getStorage().orderState[orderHash].preSigned = uint128(hashNonce + 1);

        emit ERC1155SellOrderPreSigned(
            order.maker,
            order.taker,
            order.expiry,
            order.nonce,
            order.erc20Token,
            order.erc20TokenAmount,
            order.fees,
            order.erc1155Token,
            order.erc1155TokenId,
            order.erc1155TokenAmount
        );
    }

    /// @dev Approves an ERC1155 buy order on-chain. After pre-signing
    ///      the order, the `PRESIGNED` signature type will become
    ///      valid for that order and signer.
    /// @param order An ERC1155 buy order.
    function preSignERC1155BuyOrder(LibNFTOrder.ERC1155BuyOrder memory order) external override {
        require(order.maker == msg.sender, "ONLY_MAKER");

        uint256 hashNonce = LibCommonNftOrdersStorage.getStorage().hashNonces[order.maker];
        require(hashNonce < type(uint128).max, "HASH_NONCE_OUTSIDE");

        bytes32 orderHash = getERC1155BuyOrderHash(order);
        LibERC1155OrdersStorage.getStorage().orderState[orderHash].preSigned = uint128(hashNonce + 1);

        emit ERC1155BuyOrderPreSigned(
            order.maker,
            order.taker,
            order.expiry,
            order.nonce,
            order.erc20Token,
            order.erc20TokenAmount,
            order.fees,
            order.erc1155Token,
            order.erc1155TokenId,
            order.erc1155TokenProperties,
            order.erc1155TokenAmount
        );
    }

    // Core settlement logic for selling an ERC1155 asset.
    // Used by `sellERC1155` and `onERC1155Received`.
    function _sellERC1155(
        LibNFTOrder.ERC1155BuyOrder memory buyOrder,
        LibSignature.Signature memory signature,
        SellParams memory params,
        bool allowPartialSell
    ) internal {
        LibNFTOrder.OrderInfoV2 memory orderInfo = _getOrderInfo(buyOrder);
        if (
            allowPartialSell &&
            params.sellAmount > orderInfo.remainingAmount &&
            orderInfo.remainingAmount > 0
        ) {
            params.sellAmount = orderInfo.remainingAmount;
        }
        buyOrder.erc20TokenAmount = _sellNFT(
            buyOrder.asNFTBuyOrder(),
            signature,
            orderInfo,
            params
        );

        _emitEventBuyOrderFilled(
            buyOrder,
            params.taker,
            params.tokenId,
            params.sellAmount,
            orderInfo.orderHash
        );
    }

    function _buyERC1155(
        LibNFTOrder.ERC1155SellOrder memory sellOrder,
        LibSignature.Signature memory signature,
        uint128 buyAmount,
        address taker,
        bytes memory takerData,
        bool allowPartialBuy
    ) internal {
        require(taker != address(this), "_buyERC1155/TAKER_CANNOT_SELF");
        if (taker == address(0)) {
            taker = msg.sender;
        }

        LibNFTOrder.OrderInfoV2 memory orderInfo = _getOrderInfo(sellOrder);
        if (
            allowPartialBuy &&
            buyAmount > orderInfo.remainingAmount &&
            orderInfo.remainingAmount > 0
        ) {
            buyAmount = orderInfo.remainingAmount;
        }
        sellOrder.erc20TokenAmount = _buyNFT(
            sellOrder.asNFTSellOrder(),
            signature,
            orderInfo,
            buyAmount,
            taker,
            takerData
        );

        _emitEventSellOrderFilled(
            sellOrder,
            taker,
            buyAmount,
            orderInfo.orderHash
        );
    }

    function _emitEventSellOrderFilled(
        LibNFTOrder.ERC1155SellOrder memory sellOrder,
        address taker,
        uint128 erc1155FillAmount,
        bytes32 orderHash
    ) internal {
        LibStructure.Fee[] memory fees = new LibStructure.Fee[](sellOrder.fees.length);
        for (uint256 i; i < sellOrder.fees.length; ) {
            fees[i].recipient = sellOrder.fees[i].recipient;
            unchecked {
                fees[i].amount = sellOrder.fees[i].amount * erc1155FillAmount / sellOrder.erc1155TokenAmount;
            }
            sellOrder.erc20TokenAmount += fees[i].amount;
            unchecked { ++i; }
        }

        emit ERC1155SellOrderFilled(
            orderHash,
            sellOrder.maker,
            taker,
            sellOrder.nonce,
            sellOrder.erc20Token,
            sellOrder.erc20TokenAmount,
            fees,
            sellOrder.erc1155Token,
            sellOrder.erc1155TokenId,
            erc1155FillAmount
        );
    }

    function _emitEventBuyOrderFilled(
        LibNFTOrder.ERC1155BuyOrder memory buyOrder,
        address taker,
        uint256 erc1155TokenId,
        uint128 erc1155FillAmount,
        bytes32 orderHash
    ) internal {
        LibStructure.Fee[] memory fees = new LibStructure.Fee[](buyOrder.fees.length);
        for (uint256 i; i < buyOrder.fees.length; ) {
            fees[i].recipient = buyOrder.fees[i].recipient;
            unchecked {
                fees[i].amount = buyOrder.fees[i].amount * erc1155FillAmount / buyOrder.erc1155TokenAmount;
            }
            buyOrder.erc20TokenAmount += fees[i].amount;
            unchecked { ++i; }
        }

        emit ERC1155BuyOrderFilled(
            orderHash,
            buyOrder.maker,
            taker,
            buyOrder.nonce,
            buyOrder.erc20Token,
            buyOrder.erc20TokenAmount,
            fees,
            buyOrder.erc1155Token,
            erc1155TokenId,
            erc1155FillAmount
        );
    }

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 sell order. Reverts if not.
    /// @param order The ERC1155 sell order.
    /// @param signature The signature to validate.
    function validateERC1155SellOrderSignature(
        LibNFTOrder.ERC1155SellOrder memory order,
        LibSignature.Signature memory signature
    ) external override view {
        _validateOrderSignature(getERC1155SellOrderHash(order), signature, order.maker);
    }

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 sell order. Reverts if not.
    /// @param order The ERC1155 sell order.
    /// @param signature The signature to validate.
    function validateERC1155SellOrderSignature(
        LibNFTOrder.ERC1155SellOrder memory order,
        LibSignature.Signature memory signature,
        bytes memory takerData
    ) external override view {
        if (
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK ||
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK_1271
        ) {
            (bytes32 hash, ) = _getBulkValidateHashAndExtraData(false, _getSellOrderStructHash(order), takerData);
            _validateOrderSignature(hash, signature, order.maker);
        } else {
            _validateOrderSignature(getERC1155SellOrderHash(order), signature, order.maker);
        }
    }

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 buy order. Reverts if not.
    /// @param order The ERC1155 buy order.
    /// @param signature The signature to validate.
    function validateERC1155BuyOrderSignature(
        LibNFTOrder.ERC1155BuyOrder memory order,
        LibSignature.Signature memory signature
    ) external override view {
        _validateOrderSignature(getERC1155BuyOrderHash(order), signature, order.maker);
    }

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 buy order. Reverts if not.
    /// @param order The ERC1155 buy order.
    /// @param signature The signature to validate.
    function validateERC1155BuyOrderSignature(
        LibNFTOrder.ERC1155BuyOrder memory order,
        LibSignature.Signature memory signature,
        bytes memory takerData
    ) external override view {
        if (
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK ||
            signature.signatureType == LibSignature.SignatureType.EIP712_BULK_1271
        ) {
            (bytes32 hash, ) = _getBulkValidateHashAndExtraData(true, _getBuyOrderStructHash(order), takerData);
            _validateOrderSignature(hash, signature, order.maker);
        } else {
            _validateOrderSignature(getERC1155BuyOrderHash(order), signature, order.maker);
        }
    }

    function _isOrderPreSigned(bytes32 orderHash, address maker) internal override view returns(bool) {
        return LibERC1155OrdersStorage.getStorage().orderState[orderHash].preSigned ==
        LibCommonNftOrdersStorage.getStorage().hashNonces[maker] + 1;
    }

    /// @dev Transfers an NFT asset.
    /// @param token The address of the NFT contract.
    /// @param from The address currently holding the asset.
    /// @param to The address to transfer the asset to.
    /// @param tokenId The ID of the asset to transfer.
    /// @param amount The amount of the asset to transfer.
    function _transferNFTAssetFrom(
        address token,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal override {
        _transferERC1155AssetFrom(token, from, to, tokenId, amount);
    }

    /// @dev Updates storage to indicate that the given order
    ///      has been filled by the given amount.
    /// @param orderHash The hash of `order`.
    /// @param fillAmount The amount (denominated in the NFT asset)
    ///        that the order has been filled by.
    function _updateOrderState(
        LibNFTOrder.NFTSellOrder memory /* order */,
        bytes32 orderHash,
        uint128 fillAmount
    ) internal override {
        LibERC1155OrdersStorage.getStorage().orderState[orderHash].filledAmount += fillAmount;
    }

    /// @dev Updates storage to indicate that the given order
    ///      has been filled by the given amount.
    /// @param orderHash The hash of `order`.
    /// @param fillAmount The amount (denominated in the NFT asset)
    ///        that the order has been filled by.
    function _updateOrderState(
        LibNFTOrder.NFTBuyOrder memory /* order */,
        bytes32 orderHash,
        uint128 fillAmount
    ) internal override {
        LibERC1155OrdersStorage.getStorage().orderState[orderHash].filledAmount += fillAmount;
    }

    /// @dev Get the order info for an ERC1155 sell order.
    /// @param order The ERC1155 sell order.
    /// @return orderInfo Infor about the order.
    function getERC1155SellOrderInfo(LibNFTOrder.ERC1155SellOrder memory order)
        external
        override
        view
        returns (LibNFTOrder.OrderInfo memory orderInfo)
    {
        LibNFTOrder.OrderInfoV2 memory info = _getOrderInfo(order);
        orderInfo.orderHash = info.orderHash;
        orderInfo.status = info.status;
        orderInfo.orderAmount = info.orderAmount;
        orderInfo.remainingAmount = info.remainingAmount;
        return orderInfo;
    }

    /// @dev Get the order info for an ERC1155 buy order.
    /// @param order The ERC1155 buy order.
    /// @return orderInfo Infor about the order.
    function getERC1155BuyOrderInfo(LibNFTOrder.ERC1155BuyOrder memory order)
        external
        override
        view
        returns (LibNFTOrder.OrderInfo memory orderInfo)
    {
        LibNFTOrder.OrderInfoV2 memory info = _getOrderInfo(order);
        orderInfo.orderHash = info.orderHash;
        orderInfo.status = info.status;
        orderInfo.orderAmount = info.orderAmount;
        orderInfo.remainingAmount = info.remainingAmount;
        return orderInfo;
    }

    /// @dev Get the EIP-712 hash of an ERC1155 sell order.
    /// @param order The ERC1155 sell order.
    /// @return orderHash The order hash.
    function getERC1155SellOrderHash(LibNFTOrder.ERC1155SellOrder memory order)
        public
        override
        view
        returns (bytes32 orderHash)
    {
        return _getEIP712Hash(_getSellOrderStructHash(order));
    }

    /// @dev Get the EIP-712 hash of an ERC1155 buy order.
    /// @param order The ERC1155 buy order.
    /// @return orderHash The order hash.
    function getERC1155BuyOrderHash(LibNFTOrder.ERC1155BuyOrder memory order)
        public
        override
        view
        returns (bytes32 orderHash)
    {
        return _getEIP712Hash(_getBuyOrderStructHash(order));
    }

    /// @dev Get the order nonce status bit vector for the given
    ///      maker address and nonce range.
    /// @param maker The maker of the order.
    /// @param nonceRange Order status bit vectors are indexed
    ///        by maker address and the upper 248 bits of the
    ///        order nonce. We define `nonceRange` to be these
    ///        248 bits.
    /// @return bitVector The order status bit vector for the
    ///         given maker and nonce range.
    function getERC1155OrderNonceStatusBitVector(address maker, uint248 nonceRange)
        external
        override
        view
        returns (uint256)
    {
        uint248 range = uint248(nonceRange & ORDER_NONCE_MASK);
        return LibERC1155OrdersStorage.getStorage().orderCancellationByMaker[maker][range];
    }

    function _getOrderInfo(LibNFTOrder.ERC1155SellOrder memory order)
        internal
        view
        returns (LibNFTOrder.OrderInfoV2 memory orderInfo)
    {
        orderInfo.orderAmount = order.erc1155TokenAmount;
        orderInfo.structHash = _getSellOrderStructHash(order);
        orderInfo.orderHash = _getEIP712Hash(orderInfo.structHash);

        uint256 orderBitVector;
        {
            LibERC1155OrdersStorage.Storage storage stor = LibERC1155OrdersStorage.getStorage();
            orderInfo.remainingAmount = order.erc1155TokenAmount - stor.orderState[orderInfo.orderHash].filledAmount;

            // `orderCancellationByMaker` is indexed by maker and nonce.
            uint248 nonceRange = uint248((order.nonce >> 8) & ORDER_NONCE_MASK);
            orderBitVector = stor.orderCancellationByMaker[order.maker][nonceRange];
        }

        // Check for listingTime.
        if ((order.expiry >> 32) & 0xffffffff > block.timestamp) {
            orderInfo.status = LibNFTOrder.OrderStatus.INVALID;
            return orderInfo;
        }

        // Check for expiryTime.
        if (order.expiry & 0xffffffff <= block.timestamp) {
            orderInfo.status = LibNFTOrder.OrderStatus.EXPIRED;
            return orderInfo;
        }

        // The bitvector is indexed by the lower 8 bits of the nonce.
        uint256 flag = 1 << (order.nonce & 255);
        if (orderInfo.remainingAmount == 0 || (orderBitVector & flag) != 0) {
            orderInfo.status = LibNFTOrder.OrderStatus.UNFILLABLE;
            return orderInfo;
        }

        // Otherwise, the order is fillable.
        orderInfo.status = LibNFTOrder.OrderStatus.FILLABLE;
        return orderInfo;
    }

    function _getOrderInfo(LibNFTOrder.ERC1155BuyOrder memory order)
        internal
        view
        returns (LibNFTOrder.OrderInfoV2 memory orderInfo)
    {
        orderInfo.orderAmount = order.erc1155TokenAmount;
        orderInfo.structHash = _getBuyOrderStructHash(order);
        orderInfo.orderHash = _getEIP712Hash(orderInfo.structHash);

        uint256 orderBitVector;
        {
            LibERC1155OrdersStorage.Storage storage stor = LibERC1155OrdersStorage.getStorage();
            orderInfo.remainingAmount = order.erc1155TokenAmount - stor.orderState[orderInfo.orderHash].filledAmount;

            // `orderCancellationByMaker` is indexed by maker and nonce.
            uint248 nonceRange = uint248((order.nonce >> 8) & ORDER_NONCE_MASK);
            orderBitVector = stor.orderCancellationByMaker[order.maker][nonceRange];
        }

        // Only buy orders with `erc1155TokenId` == 0 can be property orders.
        if (order.erc1155TokenProperties.length > 0 && order.erc1155TokenId != 0) {
            orderInfo.status = LibNFTOrder.OrderStatus.INVALID;
            return orderInfo;
        }

        // Buy orders cannot use ETH as the ERC20 token, since ETH cannot be
        // transferred from the buyer by a contract.
        if (address(order.erc20Token) == NATIVE_TOKEN_ADDRESS) {
            orderInfo.status = LibNFTOrder.OrderStatus.INVALID;
            return orderInfo;
        }

        // Check for listingTime.
        if ((order.expiry >> 32) & 0xffffffff > block.timestamp) {
            orderInfo.status = LibNFTOrder.OrderStatus.INVALID;
            return orderInfo;
        }

        // Check for expiryTime.
        if (order.expiry & 0xffffffff <= block.timestamp) {
            orderInfo.status = LibNFTOrder.OrderStatus.EXPIRED;
            return orderInfo;
        }

        // The bitvector is indexed by the lower 8 bits of the nonce.
        uint256 flag = 1 << (order.nonce & 255);
        if (orderInfo.remainingAmount == 0 || (orderBitVector & flag) != 0) {
            orderInfo.status = LibNFTOrder.OrderStatus.UNFILLABLE;
            return orderInfo;
        }

        // Otherwise, the order is fillable.
        orderInfo.status = LibNFTOrder.OrderStatus.FILLABLE;
        return orderInfo;
    }

    function _getBuyOrderStructHash(LibNFTOrder.ERC1155BuyOrder memory order) internal view returns(bytes32) {
        return LibNFTOrder.getERC1155BuyOrderStructHash(
            order, LibCommonNftOrdersStorage.getStorage().hashNonces[order.maker]
        );
    }

    function _getSellOrderStructHash(LibNFTOrder.ERC1155SellOrder memory order) internal view returns(bytes32) {
        return LibNFTOrder.getERC1155SellOrderStructHash(
            order, LibCommonNftOrdersStorage.getStorage().hashNonces[order.maker]
        );
    }

    function _getBulkBuyOrderTypeHash(uint256 height) internal override pure returns (bytes32) {
        return LibTypeHash.getBulkERC1155BuyOrderTypeHash(height);
    }

    function _getBulkSellOrderTypeHash(uint256 height) internal override pure returns (bytes32) {
        return LibTypeHash.getBulkERC1155SellOrderTypeHash(height);
    }

    /// @dev Matches a pair of complementary orders that have
    ///      a non-negative spread. Each order is filled at
    ///      their respective price, and the matcher receives
    ///      a profit denominated in the ERC20 token.
    /// @param sellOrder Order selling an ERC1155 asset.
    /// @param buyOrder Order buying an ERC1155 asset.
    /// @param sellOrderSignature Signature for the sell order.
    /// @param buyOrderSignature Signature for the buy order.
    /// @return profit The amount of profit earned by the caller
    ///         of this function (denominated in the ERC20 token
    ///         of the matched orders).
    function matchERC1155Order(
        LibNFTOrder.ERC1155SellOrder memory sellOrder,
        LibNFTOrder.ERC1155BuyOrder memory buyOrder,
        LibSignature.Signature memory sellOrderSignature,
        LibSignature.Signature memory buyOrderSignature,
        bytes memory sellTakerData,
        bytes memory buyTakerData
    ) external override returns (uint256 profit) {
        // The ERC1155 tokens must match
        require(sellOrder.erc1155Token == buyOrder.erc1155Token, "ERC1155_TOKEN_MISMATCH_ERROR");

        LibNFTOrder.OrderInfoV2 memory sellOrderInfo = _getOrderInfo(sellOrder);
        LibNFTOrder.OrderInfoV2 memory buyOrderInfo = _getOrderInfo(buyOrder);

        // English Auction
        if (sellOrder.expiry >> 252 == LibStructure.ORDER_KIND_ENGLISH_AUCTION) {
            require(
                sellOrderInfo.orderAmount == sellOrderInfo.remainingAmount &&
                sellOrderInfo.orderAmount == buyOrderInfo.orderAmount &&
                sellOrderInfo.orderAmount == buyOrderInfo.remainingAmount,
                "UNMATCH_ORDER_AMOUNT"
            );
        }

        // fillAmount = min(sellOrder.remainingAmount, buyOrder.remainingAmount)
        uint128 erc1155FillAmount =
            sellOrderInfo.remainingAmount < buyOrderInfo.remainingAmount ?
            sellOrderInfo.remainingAmount :
            buyOrderInfo.remainingAmount;

        _validateSellOrder(
            sellOrder.asNFTSellOrder(),
            sellOrderSignature,
            sellOrderInfo,
            buyOrder.maker,
            erc1155FillAmount,
            sellTakerData
        );
        _validateBuyOrder(
            buyOrder.asNFTBuyOrder(),
            buyOrderSignature,
            buyOrderInfo,
            sellOrder.maker,
            sellOrder.erc1155TokenId,
            erc1155FillAmount,
            buyTakerData
        );

        // Reset sellOrder.erc20TokenAmount
        if (erc1155FillAmount != sellOrderInfo.orderAmount) {
            sellOrder.erc20TokenAmount = _ceilDiv(
                sellOrder.erc20TokenAmount * erc1155FillAmount,
                sellOrderInfo.orderAmount
            );
        }
        // Reset buyOrder.erc20TokenAmount
        if (erc1155FillAmount != buyOrderInfo.orderAmount) {
            buyOrder.erc20TokenAmount =
                buyOrder.erc20TokenAmount * erc1155FillAmount / buyOrderInfo.orderAmount;
        }

        // English Auction
        if (sellOrder.expiry >> 252 == LibStructure.ORDER_KIND_ENGLISH_AUCTION) {
            _resetEnglishAuctionERC20AmountAndFees(
                sellOrder.asNFTSellOrder(),
                buyOrder.erc20TokenAmount,
                erc1155FillAmount,
                sellOrderInfo.orderAmount
            );
        }

        // The difference in ERC20 token amounts is the spread.
        uint256 spread = buyOrder.erc20TokenAmount - sellOrder.erc20TokenAmount;

        // Transfer the ERC1155 asset from seller to buyer.
        _transferERC1155AssetFrom(
            sellOrder.erc1155Token,
            sellOrder.maker,
            buyOrder.maker,
            sellOrder.erc1155TokenId,
            erc1155FillAmount
        );

        // Handle the ERC20 side of the order:
        if (
            address(sellOrder.erc20Token) == NATIVE_TOKEN_ADDRESS &&
            buyOrder.erc20Token == WETH
        ) {
            // The sell order specifies ETH, while the buy order specifies WETH.
            // The orders are still compatible with one another, but we'll have
            // to unwrap the WETH on behalf of the buyer.

            // Step 1: Transfer WETH from the buyer to the EP.
            //         Note that we transfer `buyOrder.erc20TokenAmount`, which
            //         is the amount the buyer signaled they are willing to pay
            //         for the ERC1155 asset, which may be more than the seller's
            //         ask.
            _transferERC20TokensFrom(
                address(WETH),
                buyOrder.maker,
                address(this),
                buyOrder.erc20TokenAmount
            );
            // Step 2: Unwrap the WETH into ETH. We unwrap the entire
            //         `buyOrder.erc20TokenAmount`.
            //         The ETH will be used for three purposes:
            //         - To pay the seller
            //         - To pay fees for the sell order
            //         - Any remaining ETH will be sent to
            //           `msg.sender` as profit.
            WETH.withdraw(buyOrder.erc20TokenAmount);

            // Step 3: Pay the seller (in ETH).
            _transferEth(payable(sellOrder.maker), sellOrder.erc20TokenAmount);

            // Step 4: Pay fees for the buy order. Note that these are paid
            //         in _WETH_ by the _buyer_. By signing the buy order, the
            //         buyer signals that they are willing to spend a total
            //         of `erc20TokenAmount` _plus_ fees, all denominated in
            //         the `erc20Token`, which in this case is WETH.
            _payFees(
                buyOrder.asNFTSellOrder(),
                buyOrder.maker, // payer
                erc1155FillAmount,
                buyOrderInfo.orderAmount,
                false           // useNativeToken
            );

            // Step 5: Pay fees for the sell order. The `erc20Token` of the
            //         sell order is ETH, so the fees are paid out in ETH.
            //         There should be `spread` wei of ETH remaining in the
            //         EP at this point, which we will use ETH to pay the
            //         sell order fees.
            uint256 sellOrderFees = _payFees(
                sellOrder.asNFTSellOrder(),
                address(this), // payer
                erc1155FillAmount,
                sellOrderInfo.orderAmount,
                true           // useNativeToken
            );

            // Step 6: The spread less the sell order fees is the amount of ETH
            //         remaining in the EP that can be sent to `msg.sender` as
            //         the profit from matching these two orders.
            profit = spread - sellOrderFees;
            if (profit > 0) {
               _transferEth(payable(msg.sender), profit);
            }
        } else {
            // ERC20 tokens must match
            require(sellOrder.erc20Token == buyOrder.erc20Token, "ERC20_TOKEN_MISMATCH_ERROR");

            // Step 1: Transfer the ERC20 token from the buyer to the seller.
            //         Note that we transfer `sellOrder.erc20TokenAmount`, which
            //         is at most `buyOrder.erc20TokenAmount`.
            _transferERC20TokensFrom(
                address(buyOrder.erc20Token),
                buyOrder.maker,
                sellOrder.maker,
                sellOrder.erc20TokenAmount
            );

            // Step 2: Pay fees for the buy order. Note that these are paid
            //         by the buyer. By signing the buy order, the buyer signals
            //         that they are willing to spend a total of
            //         `buyOrder.erc20TokenAmount` _plus_ `buyOrder.fees`.
            _payFees(
                buyOrder.asNFTSellOrder(),
                buyOrder.maker, // payer
                erc1155FillAmount,
                buyOrderInfo.orderAmount,
                false           // useNativeToken
            );

            // Step 3: Pay fees for the sell order. These are paid by the buyer
            //         as well. After paying these fees, we may have taken more
            //         from the buyer than they agreed to in the buy order. If
            //         so, we revert in the following step.
            uint256 sellOrderFees = _payFees(
                sellOrder.asNFTSellOrder(),
                buyOrder.maker, // payer
                erc1155FillAmount,
                sellOrderInfo.orderAmount,
                false           // useNativeToken
            );

            // Step 4: We calculate the profit as:
            //         profit = buyOrder.erc20TokenAmount - sellOrder.erc20TokenAmount - sellOrderFees
            //                = spread - sellOrderFees
            //         I.e. the buyer would've been willing to pay up to `profit`
            //         more to buy the asset, so instead that amount is sent to
            //         `msg.sender` as the profit from matching these two orders.
            profit = spread - sellOrderFees;
            if (profit > 0) {
                _transferERC20TokensFrom(
                    address(buyOrder.erc20Token),
                    buyOrder.maker,
                    msg.sender,
                    profit
                );
            }
        }

        _emitEventSellOrderFilled(
            sellOrder,
            buyOrder.maker, // taker
            erc1155FillAmount,
            sellOrderInfo.orderHash
        );

        _emitEventBuyOrderFilled(
            buyOrder,
            sellOrder.maker, // taker
            sellOrder.erc1155TokenId,
            erc1155FillAmount,
            buyOrderInfo.orderHash
        );
    }
}
