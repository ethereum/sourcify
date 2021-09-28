export default class ContractCallDecoder {
    /**
     * Extracts cbor encoded segement from bytecode
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {any}
     * @example
     *   > { ipfs: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq" }
     */
    static decodeMetadataHash(hexStringByteCode: string): Promise<any>;
}
