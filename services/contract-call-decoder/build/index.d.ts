import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Transaction } from 'web3-core';
declare type MetadataOutput = {
    abi: AbiItem[];
    userdoc: any;
    devdoc: any;
};
declare type DecodedMetadataHash = {
    origin: string;
    hash: string;
};
declare type DecodeOutput = {
    functionName: 'string';
    params: any;
    userdoc: {
        notice: string;
    } | undefined;
    devdoc: {
        details: string | undefined;
        params: any;
        returns: any;
    } | undefined;
};
export default class ContractCallDecoder {
    private web3;
    private ipfsGateway;
    utils: Web3['utils'];
    private timeout;
    constructor(rpcURL?: string, ipfsGateway?: string, timeout?: number);
    /**
     * Main functionality of the ContractCallDecoder
     *
     * @param tx - Web3 Transaction object
     * @param contractAddress
     * @returns
     */
    decode(tx: Transaction): Promise<DecodeOutput>;
    /**
     * Funcion to fetch the metadata from IPFS. Requires the gateway to accept links as <gatewayURL>/ipfs/<hash>
     *
     * @param metadataHash - hash and origin of the metadata to be fetched
     * @returns the metadata file as an object
     */
    fetchMetadataWithHash(metadataHash: DecodedMetadataHash): Promise<any>;
    fetchMetadataOutputWithHash(metadataHash: DecodedMetadataHash): Promise<MetadataOutput>;
    /**
     * Decodes a cbor encoded string into an object
     *
     * @param hexStringByteCode
     * @returns
     */
    static decodeCborAtTheEnd(hexStringByteCode: string): any;
    static getHashFromDecodedCbor(decodedCbor: any): DecodedMetadataHash;
    /**
     * Wrapper function to directly decode the whole bytecode.
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {MetadataOutput} the hash decoded from bytecode and its format
     * @example
     *   { origin: "ipfs", hash: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq"}
     */
    static decodeMetadataHash(hexStringByteCode: string): DecodedMetadataHash;
    /**
     * Function to decode a human readable documentation for the called function.
     *
     * @param tx - Transaction object
     * @param metadataOutput - output field of the metadata.json. Includes abi, userdoc, devdoc
     * @returns an Object with all extractable useful information
     *
     * @example
     * return {
     *  functionName: 'mint',
     *  params: [
     *    {
     *      name: '_to',
     *      type: 'address',
     *      value: '0xAA6042aa65eb93C6439cDaeBC27B3bd09c5DFe94'
     *    },
     *    { name: '_amount', type: 'uint256', value: '1000000000000000000' }
     *  ],
     *  userdoc: {
     *    notice: 'Creates 1000000000000000000 token to 0xAA6042aa65eb93C6439cDaeBC27B3bd09c5DFe94. Must only be called by the owner (MasterChef).'
     *  },
     *  devdoc: undefined
     * }
     */
    decodeDocumentation(tx: Transaction, metadataOutput: MetadataOutput): Promise<any>;
    /**
     * Function to generate the standard function signature from an AbiItem.
     *
     * Function signature === 'mint(address,uint256)'
     *
     * Function signature !== '0x4fa2d1f9'
     *
     * Function signature is the function name + parameter types that is hashed to create the function selector/function ID. The (first 4 bytes of the) hash is sometimes wrongly named as the "function signature" but the signature is the unhashed version. See https://docs.soliditylang.org/en/v0.8.8/abi-spec.html#function-selector
     *
     * @param functionAbiItem
     * @returns
     * @example
     * // returns "mint(address,uint256)"
     * generateFunctionSignature({
          "inputs": [
            { "internalType": "address", "name": "_to", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
          ],
          "name": "mint",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        })
     */
    generateFunctionSignature(functionAbiItem: AbiItem): string;
    /**
     * Function to find the function in the abi array, using its signatureHash.
     *
     * @param functionSignatureHash
     * @param abi
     * @returns The matched AbiItem
     *
     * @example
     *  const abiItem: AbiItem = findAbiItemFromSignature('0x4fdba32d', [...])
     *  console.log(abiItem)
     *  // returns
     *    {
            "inputs": [
              { "internalType": "address", "name": "owner", "type": "address" },
              { "internalType": "address", "name": "spender", "type": "address" }
            ],
            "name": "allowance",
            "outputs": [
              { "internalType": "uint256", "name": "", "type": "uint256" }
            ],
            "stateMutability": "view",
            "type": "function"
          }
     */
    findAbiItemFromSignatureHash(functionSignatureHash: string, abi: AbiItem[]): AbiItem;
    /**
     * Funtion to parse and fill the variables in the dynamic NatSpec expression
     *
     * @param expression - @notice or @dev comments of functions in dynamic Natspec
     * @param abi - the whole abi array of the contract
     * @param tx - Transaction object
     * @returns filled NatSpec
     * @example
     *  // returns "Sends 100000000 tokens to 0x88B6d1389736270c16604EeC0c1fdA318dc7e3BC"
     *  fillNatSpecExpression("Sends `_amount` tokens to `_address`", [{},...,{}], "0xa2fs...21a")
     */
    fillNatSpecExpression(expression: string, abi: AbiItem[], tx: Transaction): string;
    private isAddress;
    /**
     * Function to fetch the contract deployed byte code. Requires the address of the contract
     *
     * @param address - Contract address
     * @returns the deployed bytecode as a string
     */
    fetchDeployedByteCode(address: string): Promise<string>;
}
export {};
