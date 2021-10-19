import Web3 from 'web3';
declare type MetadataOutput = {
    abi: Array<any>;
    userdoc: Array<any>;
    devdoc: Array<any>;
};
export default class ContractCallDecoder {
    ipfsGateway: string;
    web3Provider: Web3;
    /**
     * Extracts cbor encoded segement from bytecode
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {any}
     * @example
     *   > { ipfs: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq" }
     */
    constructor(rpcURL?: string, ipfsGateway?: string);
    /**
     * Funcion to fetch the metadata from IPFS. Requires the gateway to accept links as <gatewayURL>/ipfs/<hash>
     *
     * @param metadataHash - IPFS CID to be fetched
     * @returns the metadata file as an object
     */
    fetchMetadataWithHash(metadataHash: string): Promise<any>;
    fetchMetadataOutputWithHash(metadataHash: string): Promise<MetadataOutput>;
    /**
     *
     * @param hexStringByteCode Bytecode of the contract in hex string
     * @returns Metadata hash in string
     */
    static decodeMetadataHash(hexStringByteCode: string): Promise<string>;
}
export {};
