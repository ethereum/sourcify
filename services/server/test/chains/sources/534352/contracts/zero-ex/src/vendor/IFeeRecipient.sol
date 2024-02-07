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


interface IFeeRecipient {

    /// @dev A callback function invoked in the ERC721Feature for each ERC721
    ///      order fee that get paid. Integrators can make use of this callback
    ///      to implement arbitrary fee-handling logic, e.g. splitting the fee
    ///      between multiple parties.
    /// @param tokenAddress The address of the token in which the received fee is
    ///        denominated. `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` indicates
    ///        that the fee was paid in the native token (e.g. ETH).
    /// @param amount The amount of the given token received.
    /// @param feeData Arbitrary data encoded in the `Fee` used by this callback.
    /// @return success The selector of this function (0x0190805e),
    ///         indicating that the callback succeeded.
    function receiveZeroExFeeCallback(address tokenAddress, uint256 amount, bytes calldata feeData) external returns (bytes4 success);
}
