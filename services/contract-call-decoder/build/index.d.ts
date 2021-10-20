import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
declare type MetadataOutput = {
    abi: AbiItem[];
    userdoc: any;
    devdoc: any;
};
export default class ContractCallDecoder {
    web3: Web3;
    constructor(rpcURL: string);
    /**
     * Extracts cbor encoded segement from bytecode
     *
     * @param  {string} -hexStringByteCode bytecode in hex
     * @return {any}
     * @example
     *   > { ipfs: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq" }
     */
    static decodeMetadataHash(hexStringByteCode: string): Promise<any>;
    /**
     * Function to decode a human readable documentation for the called function.
     *
     * @param hexTxInput - input transaction data in hex string
     * @param metadataOutput - output field of the metadata.json. Includes abi, userdoc, devdoc
     * @returns an Object with all extractable useful information
     *
     * @example
     * return {
        functionName: 'mint',
        params: [
          {
            name: '_to',
            type: 'address',
            value: '0xAA6042aa65eb93C6439cDaeBC27B3bd09c5DFe94'
          },
          { name: '_amount', type: 'uint256', value: '1000000000000000000' }
        ],
        userdoc: {
          notice: 'Creates 1000000000000000000 token to 0xAA6042aa65eb93C6439cDaeBC27B3bd09c5DFe94. Must only be called by the owner (MasterChef).'
        },
        devdoc: undefined
      }
     */
    decodeDocumentation(hexTxInput: string, metadataOutput: MetadataOutput): Promise<any>;
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
     * Creates signatureHash for each AbiItem (constructor, event, function etc.). Returns the matching AbiItem
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
     * @param txData - transaction input in hex string
     * @returns filled NatSpec
     * @example
     *  // returns "Sends 100000000 tokens to 0x88B6d1389736270c16604EeC0c1fdA318dc7e3BC"
     *  fillNatSpecExpression("Sends `_amount` tokens to `_address`", [{},...,{}], "0xa2fs...21a")
     */
    fillNatSpecExpression(expression: string, abi: AbiItem[], txData: string): string;
}
export {};
