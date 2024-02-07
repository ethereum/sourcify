// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;


library LibMultiCall {

    uint256 private constant SELECTOR_MASK = (0xffffffff << 224);

    function _multiCall(
        address impl,
        bytes4 targetSelector,
        bytes4 checkupSelector,
        bytes[] calldata datas,
        bool revertIfIncomplete
    ) internal {
        assembly {
            let someSuccess := 0
            let ptrEnd := add(datas.offset, mul(datas.length, 0x20))
            for { let ptr := datas.offset } lt(ptr, ptrEnd) { ptr := add(ptr, 0x20) } {
                let ptrData := add(datas.offset, calldataload(ptr))

                // Check the data length
                let dataLength := calldataload(ptrData)
                if lt(dataLength, 0x4) {
                    if revertIfIncomplete {
                        _revertDatasError()
                    }
                    continue
                }

                let calldataSelector := and(calldataload(add(ptrData, 0x20)), SELECTOR_MASK)
                if eq(calldataSelector, checkupSelector) {
                    // Copy calldata to memory
                    mstore(0, targetSelector)
                    calldatacopy(0x4, add(ptrData, 0x24), sub(dataLength, 0x4))

                    if delegatecall(gas(), impl, 0, dataLength, 0, 0) {
                        someSuccess := 1
                        continue
                    }

                    if revertIfIncomplete {
                        returndatacopy(0, 0, returndatasize())
                        revert(0, returndatasize())
                    }
                    continue
                }

                if revertIfIncomplete {
                    _revertSelectorMismatch()
                }
            }

            if iszero(someSuccess) {
                _revertNoCallSuccess()
            }

            function _revertDatasError() {
                // revert("_multiCall: data error")
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(0x40, 0x000000165f6d756c746943616c6c3a2064617461206572726f72000000000000)
                mstore(0x60, 0)
                revert(0, 0x64)
            }

            function _revertSelectorMismatch() {
                // revert("_multiCall: selector mismatch")
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(0x40, 0x0000001d5f6d756c746943616c6c3a2073656c6563746f72206d69736d617463)
                mstore(0x60, 0x6800000000000000000000000000000000000000000000000000000000000000)
                revert(0, 0x64)
            }

            function _revertNoCallSuccess() {
                // revert("_multiCall: all calls failed")
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(0x40, 0x0000001c5f6d756c746943616c6c3a20616c6c2063616c6c73206661696c6564)
                mstore(0x60, 0)
                revert(0, 0x64)
            }
        }
    }
}
