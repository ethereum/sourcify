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
import timeoutSignal from 'timeout-signal';
const bytesToHashProcessors = [
    { origin: "ipfs", process: toB58String },
    { origin: "bzzr0", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) },
    { origin: "bzzr1", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }
];
export default class ContractCallDecoder {
    constructor(rpcURL = "http://localhost:8545", ipfsGateway = "https://ipfs.io", timeout = 30000) {
        this.ipfsGateway = ipfsGateway;
        this.web3Provider = new Web3(rpcURL);
        this.timeout = timeout; // timeout to wait for the IPFS gateway response.
    }
    /**
     * Funcion to fetch the metadata from IPFS. Requires the gateway to accept links as <gatewayURL>/ipfs/<hash>
     *
     * @param metadataHash - IPFS CID to be fetched
     * @returns the metadata file as an object
     */
    fetchMetadataWithHash(metadataHash) {
        return __awaiter(this, void 0, void 0, function* () {
            let response;
            try {
                response = yield fetch(`${this.ipfsGateway}/ipfs/${metadataHash}`, { signal: timeoutSignal(this.timeout) });
            }
            catch (err) {
                if (err.type === 'aborted') {
                    throw new Error(`Timeout fetching from the IPFS gateway ${this.ipfsGateway}`);
                }
                throw err;
            }
            if (response.ok) {
                return response.json();
            }
            else {
                const msg = yield response.text();
                throw new Error(msg);
            }
        });
    }
    fetchMetadataOutputWithHash(metadataHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = this.fetchMetadataWithHash(metadataHash);
            return metadata.output;
        });
    }
    // Code from /services/core/src/utils/utils.ts and /monitor/utils.ts
    /**
     * Extracts cbor encoded segement from bytecode
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {string} the hash decoded from bytecode.
     * @example
     *   "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq"
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