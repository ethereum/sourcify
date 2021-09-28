"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cbor_1 = __importDefault(require("cbor"));
const web3_1 = __importDefault(require("web3"));
const multihashes_1 = __importDefault(require("multihashes"));
const bytesToHashProcessors = [
    { origin: "ipfs", process: multihashes_1.default.toB58String },
    { origin: "bzzr0", process: (data) => web3_1.default.utils.bytesToHex([...data]).slice(2) },
    { origin: "bzzr1", process: (data) => web3_1.default.utils.bytesToHex([...data]).slice(2) }
];
class ContractCallDecoder {
    // TODO: Refactor for reuse 
    // Code from /services/core/src/utils/utils.ts and /monitor/utils.ts
    /**
     * Extracts cbor encoded segement from bytecode
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {any}
     * @example
     *   > { ipfs: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq" }
     */
    static async decodeMetadataHash(hexStringByteCode) {
        const numArrayByteCode = web3_1.default.utils.hexToBytes(hexStringByteCode);
        const cborLength = numArrayByteCode[numArrayByteCode.length - 2] * 0x100 + numArrayByteCode[numArrayByteCode.length - 1];
        const bytecodeBuffer = Buffer.from(numArrayByteCode.slice(numArrayByteCode.length - 2 - cborLength, -2));
        const bufferObject = await cbor_1.default.decodeFirst(bytecodeBuffer);
        for (const processor of bytesToHashProcessors) {
            const origin = processor.origin;
            if (bufferObject[origin])
                return processor.process(bufferObject[origin]);
        }
        throw new Error(`Couldn't decode the hash format: ${origin}`);
    }
}
exports.default = ContractCallDecoder;
ContractCallDecoder.decodeMetadataHash('0x608060405234801561001057600080fd5b506004361061004c5760003560e01c80637bd703e81461005157806390b98a11146100a957806396e4ee3d1461010f578063f8b2cb4f1461015b575b600080fd5b6100936004803603602081101561006757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506101b3565b6040518082815260200191505060405180910390f35b6100f5600480360360408110156100bf57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506101cf565b604051808215151515815260200191505060405180910390f35b6101456004803603604081101561012557600080fd5b810190808035906020019092919080359060200190929190505050610328565b6040518082815260200191505060405180910390f35b61019d6004803603602081101561017157600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610335565b6040518082815260200191505060405180910390f35b60006101c86101c183610335565b6002610328565b9050919050565b6000816000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410156102205760009050610322565b816000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282540392505081905550816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190505b92915050565b6000818302905092915050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905091905056fea2646970667358221220711ac087831068bd33b58ebff95a8cdb23734e3a7a5c3c30fdb0d01e2b73c1ae64736f6c63430006020033')
    .then(ipfsHash => console.log(ipfsHash));
//# sourceMappingURL=index.js.map