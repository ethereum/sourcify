// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IUPTNAddressValidator {
    function isBlacklist(address account) external view returns (bool);
    function addBlacklist(address account) external;
    function removeBlacklist(address account) external;

    function isWhitelist(bytes32 tokenHash, address account) external view returns (bool);
    function addWhitelist(bytes32 tokenHash, address account) external;
    function removeWhitelist(bytes32 tokenHash, address account) external;

    function whitelistPaused(bytes32 tokenHash) external view returns (bool);
    function pauseWhitelist(bytes32 tokenHash) external;
    function unpauseWhitelist(bytes32 tokenHash) external;

    function isValid(bytes32 tokenHash, address fromAccount, address toAccount) external view returns (bool);
}
