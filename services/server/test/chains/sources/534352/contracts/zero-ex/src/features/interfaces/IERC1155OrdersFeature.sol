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
import "../libs/LibNFTOrder.sol";
import "../libs/LibSignature.sol";
import "./IERC1155OrdersEvent.sol";


/// @dev Feature for interacting with ERC1155 orders.
interface IERC1155OrdersFeature is IERC1155OrdersEvent {

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
        LibNFTOrder.ERC1155BuyOrder calldata buyOrder,
        LibSignature.Signature calldata signature,
        uint256 erc1155TokenId,
        uint128 erc1155SellAmount,
        bool unwrapNativeToken,
        bytes calldata takerData
    ) external;

    /// @dev Sells multiple ERC1155 assets by filling the
    ///      given orders.
    /// @param datas The encoded `sellERC1155` calldatas.
    /// @param revertIfIncomplete If true, reverts if this
    ///        function fails to fill any individual order.
    function batchSellERC1155s(bytes[] calldata datas, bool revertIfIncomplete) external;

    /// @param sellOrder The ERC1155 sell order.
    /// @param signature The order signature.
    /// @param taker The address to receive ERC1155. If this parameter
    ///        is zero, transfer ERC1155 to `msg.sender`.
    /// @param erc1155BuyAmount The amount of the ERC1155 asset
    ///        to buy.
    function buyERC1155Ex(
        LibNFTOrder.ERC1155SellOrder calldata sellOrder,
        LibSignature.Signature calldata signature,
        address taker,
        uint128 erc1155BuyAmount,
        bytes calldata takerData
    ) external payable;

    /// @dev Cancel a single ERC1155 order by its nonce. The caller
    ///      should be the maker of the order. Silently succeeds if
    ///      an order with the same nonce has already been filled or
    ///      cancelled.
    /// @param orderNonce The order nonce.
    function cancelERC1155Order(uint256 orderNonce) external;

    /// @dev Cancel multiple ERC1155 orders by their nonces. The caller
    ///      should be the maker of the orders. Silently succeeds if
    ///      an order with the same nonce has already been filled or
    ///      cancelled.
    /// @param orderNonces The order nonces.
    function batchCancelERC1155Orders(uint256[] calldata orderNonces) external;

    /// @dev Buys multiple ERC1155 assets by filling the
    ///      given orders.
    /// @param sellOrders The ERC1155 sell orders.
    /// @param signatures The order signatures.
    /// @param erc1155TokenAmounts The amounts of the ERC1155 assets
    ///        to buy for each order.
    /// @param takers The address to receive ERC1155.
    /// @param takerDatas The data (if any) to pass to the taker
    ///        callback for each order. Refer to the `takerData`
    ///        parameter to for `buyERC1155`.
    /// @param revertIfIncomplete If true, reverts if this
    ///        function fails to fill any individual order.
    /// @return successes An array of booleans corresponding to whether
    ///         each order in `orders` was successfully filled.
    function batchBuyERC1155sEx(
        LibNFTOrder.ERC1155SellOrder[] calldata sellOrders,
        LibSignature.Signature[] calldata signatures,
        address[] calldata takers,
        uint128[] calldata erc1155TokenAmounts,
        bytes[] calldata takerDatas,
        bool revertIfIncomplete
    ) external payable returns (bool[] memory successes);

    /// @dev Callback for the ERC1155 `safeTransferFrom` function.
    ///      This callback can be used to sell an ERC1155 asset if
    ///      a valid ERC1155 order, signature and `unwrapNativeToken`
    ///      are encoded in `data`. This allows takers to sell their
    ///      ERC1155 asset without first calling `setApprovalForAll`.
    /// @param operator The address which called `safeTransferFrom`.
    /// @param from The address which previously owned the token.
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
        address from,
        uint256 tokenId,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4 success);

    /// @dev Approves an ERC1155 sell order on-chain. After pre-signing
    ///      the order, the `PRESIGNED` signature type will become
    ///      valid for that order and signer.
    /// @param order An ERC1155 sell order.
    function preSignERC1155SellOrder(LibNFTOrder.ERC1155SellOrder calldata order) external;

    /// @dev Approves an ERC1155 buy order on-chain. After pre-signing
    ///      the order, the `PRESIGNED` signature type will become
    ///      valid for that order and signer.
    /// @param order An ERC1155 buy order.
    function preSignERC1155BuyOrder(LibNFTOrder.ERC1155BuyOrder calldata order) external;

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 sell order. Reverts if not.
    /// @param order The ERC1155 sell order.
    /// @param signature The signature to validate.
    function validateERC1155SellOrderSignature(
        LibNFTOrder.ERC1155SellOrder calldata order,
        LibSignature.Signature calldata signature
    ) external view;

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 sell order. Reverts if not.
    /// @param order The ERC1155 sell order.
    /// @param signature The signature to validate.
    function validateERC1155SellOrderSignature(
        LibNFTOrder.ERC1155SellOrder calldata order,
        LibSignature.Signature calldata signature,
        bytes calldata takerData
    ) external view;

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 buy order. Reverts if not.
    /// @param order The ERC1155 buy order.
    /// @param signature The signature to validate.
    function validateERC1155BuyOrderSignature(
        LibNFTOrder.ERC1155BuyOrder calldata order,
        LibSignature.Signature calldata signature
    ) external view;

    /// @dev Checks whether the given signature is valid for the
    ///      the given ERC1155 buy order. Reverts if not.
    /// @param order The ERC1155 buy order.
    /// @param signature The signature to validate.
    function validateERC1155BuyOrderSignature(
        LibNFTOrder.ERC1155BuyOrder calldata order,
        LibSignature.Signature calldata signature,
        bytes calldata takerData
    ) external view;

    /// @dev Get the order info for an ERC1155 sell order.
    /// @param order The ERC1155 sell order.
    /// @return orderInfo Infor about the order.
    function getERC1155SellOrderInfo(LibNFTOrder.ERC1155SellOrder calldata order)
        external
        view
        returns (LibNFTOrder.OrderInfo memory orderInfo);

    /// @dev Get the order info for an ERC1155 buy order.
    /// @param order The ERC1155 buy order.
    /// @return orderInfo Infor about the order.
    function getERC1155BuyOrderInfo(LibNFTOrder.ERC1155BuyOrder calldata order)
        external
        view
        returns (LibNFTOrder.OrderInfo memory orderInfo);

    /// @dev Get the EIP-712 hash of an ERC1155 sell order.
    /// @param order The ERC1155 sell order.
    /// @return orderHash The order hash.
    function getERC1155SellOrderHash(LibNFTOrder.ERC1155SellOrder calldata order)
        external
        view
        returns (bytes32 orderHash);

    /// @dev Get the EIP-712 hash of an ERC1155 buy order.
    /// @param order The ERC1155 buy order.
    /// @return orderHash The order hash.
    function getERC1155BuyOrderHash(LibNFTOrder.ERC1155BuyOrder calldata order)
        external
        view
        returns (bytes32 orderHash);

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
        view
        returns (uint256);

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
        LibNFTOrder.ERC1155SellOrder calldata sellOrder,
        LibNFTOrder.ERC1155BuyOrder calldata buyOrder,
        LibSignature.Signature calldata sellOrderSignature,
        LibSignature.Signature calldata buyOrderSignature,
        bytes calldata sellTakerData,
        bytes calldata buyTakerData
    ) external returns (uint256 profit);
}
