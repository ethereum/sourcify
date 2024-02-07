// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;


library LibStructure {

    uint256 constant ORDER_KIND_DUTCH_AUCTION = 1;
    uint256 constant ORDER_KIND_ENGLISH_AUCTION = 2;
    uint256 constant ORDER_KIND_BATCH_OFFER_ERC721S = 8;

    struct Fee {
        address recipient;
        uint256 amount;
    }
}
