// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface Type {
    struct InitiazationObject{
        address vrf;
        bytes32 key_hash;
    }
}

contract DeploymentHelper {

    address constant ARB_VRF = 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61;
    address constant SEPOLIA_VRF = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
    bytes32 constant SEPOLIA_HASH = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;
    bytes32 constant ARB_HASH = 0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be;

    Type.InitiazationObject private activeIntializationObJect;

    constructor() {
        if (block.chainid == 421614) {
            activeIntializationObJect = getArbitriumConfig();
        } else if (block.chainid == 11155111) {
            activeIntializationObJect = getSepoliaConfig();
        } else {
            activeIntializationObJect = getAnvilConfig();
        }
    }

    function getArbitriumConfig() internal pure returns (Type.InitiazationObject memory) {
        return Type.InitiazationObject({vrf: ARB_VRF, key_hash: ARB_HASH});
    }

    function getSepoliaConfig() internal pure returns (Type.InitiazationObject memory) {
        return Type.InitiazationObject({vrf: SEPOLIA_VRF, key_hash: SEPOLIA_HASH});
    }

    function getAnvilConfig() internal pure returns (Type.InitiazationObject memory) {
        return Type.InitiazationObject({vrf: ARB_VRF, key_hash: SEPOLIA_HASH});
    }

    function getActiveConfig() external view returns (Type.InitiazationObject memory) {
        return activeIntializationObJect;
    }
}
