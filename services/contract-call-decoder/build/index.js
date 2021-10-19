var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { decodeFirst } from 'cbor';
import Web3 from 'web3';
import { toB58String } from 'multihashes';
import fetch from 'node-fetch';
const bytesToHashProcessors = [
    { origin: "ipfs", process: toB58String },
    { origin: "bzzr0", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) },
    { origin: "bzzr1", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }
];
export default class ContractCallDecoder {
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
    constructor(rpcURL = "http://localhost:8545", ipfsGateway = "https://ipfs.io") {
        this.ipfsGateway = ipfsGateway;
        this.web3Provider = new Web3(rpcURL);
    }
    /**
     * Funcion to fetch the metadata from IPFS. Requires the gateway to accept links as <gatewayURL>/ipfs/<hash>
     *
     * @param metadataHash - IPFS CID to be fetched
     * @returns the metadata file as an object
     */
    fetchMetadataWithHash(metadataHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = yield (yield fetch(`${this.ipfsGateway}/ipfs/${metadataHash}`)).json();
            return metadata;
        });
    }
    fetchMetadataOutputWithHash(metadataHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = this.fetchMetadataWithHash(metadataHash);
            return metadata.output;
        });
    }
    /**
     *
     * @param hexStringByteCode Bytecode of the contract in hex string
     * @returns Metadata hash in string
     */
    static decodeMetadataHash(hexStringByteCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const numArrayByteCode = Web3.utils.hexToBytes(hexStringByteCode); // convert to number array
            const cborLength = numArrayByteCode[numArrayByteCode.length - 2] * 0x100 + numArrayByteCode[numArrayByteCode.length - 1];
            const bytecodeBuffer = Buffer.from(numArrayByteCode.slice(numArrayByteCode.length - 2 - cborLength, -2));
            const bufferObject = yield decodeFirst(bytecodeBuffer); // decode first cbor occurance
            // check which protocol the decoded object matches. ipfs, bzzr1... etc. Decode the string according to the protocol's hash format.
            for (const processor of bytesToHashProcessors) {
                const origin = processor.origin;
                if (bufferObject[origin])
                    return processor.process(bufferObject[origin]);
            }
            throw new Error(`Couldn't decode the hash format: ${origin}`);
        });
    }
}
//# sourceMappingURL=index.js.map