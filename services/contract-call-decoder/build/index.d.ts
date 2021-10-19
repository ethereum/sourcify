import Web3 from 'web3';
declare type MetadataOutput = {
    abi: Array<any>;
    userdoc: Array<any>;
    devdoc: Array<any>;
};
export default class ContractCallDecoder {
    ipfsGateway: string;
    web3Provider: Web3;
    timeout: number;
    constructor(rpcURL?: string, ipfsGateway?: string, timeout?: number);
    /**
     * Funcion to fetch the metadata from IPFS. Requires the gateway to accept links as <gatewayURL>/ipfs/<hash>
     *
     * @param metadataHash - IPFS CID to be fetched
     * @returns the metadata file as an object
     */
    fetchMetadataWithHash(metadataHash: string): Promise<any>;
    fetchMetadataOutputWithHash(metadataHash: string): Promise<MetadataOutput>;
    /**
     * Extracts cbor encoded segement from bytecode
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {string} the hash decoded from bytecode.
     * @example
     *   "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq"
     */
    static decodeMetadataHash(hexStringByteCode: string): Promise<string>;
}
export {};
