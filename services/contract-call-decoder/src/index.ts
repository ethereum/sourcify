import {decodeFirst} from 'cbor';
import Web3 from 'web3';
import { toB58String } from 'multihashes';
import fetch from 'node-fetch';
import {Response} from 'node-fetch/@types';
import timeoutSignal from 'timeout-signal';
// @ts-ignore
import {evaluate} from 'radspec';
import {AbiItem} from 'web3-utils';
interface Processor {
    origin: string,
    process: (bytes: Buffer) => string
}

type MetadataOutput = {
  abi: AbiItem[],
  userdoc: any,
  devdoc: any
}

const bytesToHashProcessors: Processor[] = [
    { origin: "ipfs", process: toB58String },
    { origin: "bzzr0", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }, // convert buffer to number[] with [...data]
    { origin: "bzzr1", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }
]

export default class ContractCallDecoder {

  ipfsGateway: string;
  web3: Web3;
  timeout: number;
  
  constructor(rpcURL = "http://localhost:8545", ipfsGateway = "https://ipfs.io", timeout = 30000) {
    this.ipfsGateway = ipfsGateway;
    this.web3 = new Web3(rpcURL);
    this.timeout = timeout; // timeout to wait for the IPFS gateway response.
  }

  /**
   * Funcion to fetch the metadata from IPFS. Requires the gateway to accept links as <gatewayURL>/ipfs/<hash>
   * 
   * @param metadataHash - IPFS CID to be fetched
   * @returns the metadata file as an object
   */
  async fetchMetadataWithHash(metadataHash: string): Promise<any> {
    let response: Response

    try {
      response = await fetch(`${this.ipfsGateway}/ipfs/${metadataHash}`, {signal: timeoutSignal(this.timeout)});
    } catch (err: any) { // Catch timeout
      if (err.type === 'aborted') {
        throw new Error(`Timeout fetching from the IPFS gateway ${this.ipfsGateway}`)
      }
      throw err;
    }

    if (response.ok) { // OK
      return response.json();
    } else { // Send Error message
      const msg = await response.text();
      throw new Error(msg)
    }
  }

  async fetchMetadataOutputWithHash(metadataHash: string): Promise<MetadataOutput> {
    const metadata: any = this.fetchMetadataWithHash(metadataHash);
    return metadata.output;
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
  static async decodeMetadataHash(hexStringByteCode: string): Promise<string> {
      const numArrayByteCode = Web3.utils.hexToBytes(hexStringByteCode); // convert to number array
      const cborLength: number = numArrayByteCode[numArrayByteCode.length - 2] * 0x100 + numArrayByteCode[numArrayByteCode.length - 1];
      const bytecodeBuffer = Buffer.from(numArrayByteCode.slice(numArrayByteCode.length - 2 - cborLength, -2));
      const bufferObject = await decodeFirst(bytecodeBuffer); // decode first cbor occurance

      // check which protocol the decoded object matches. ipfs, bzzr1... etc. Decode the string according to the protocol's hash format.
      for (const processor of bytesToHashProcessors) {
        const origin = processor.origin;
        if (bufferObject[origin])
          return processor.process(bufferObject[origin])
      }
      throw new Error(`Couldn't decode the hash format: ${origin}`);
  }
  
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
  async decodeDocumentation( hexTxInput: string, metadataOutput: MetadataOutput ): Promise<any> {
    // 0x + 4bytes
    const functionSignatureHash = hexTxInput.slice(0,10);
    const hexTxInputData = hexTxInput.slice(10);
    const functionAbiItem = this.findAbiItemFromSignatureHash(functionSignatureHash, metadataOutput.abi)
    const paramValues = this.web3.eth.abi.decodeParameters(functionAbiItem.inputs, hexTxInputData);
    const params = functionAbiItem.inputs.map(param => {
      return {name: param.name, type: param.type, value: paramValues[param.name]}
    });
    const functionSignature = this.generateFunctionSignature(functionAbiItem);
    const userdocItem = metadataOutput.userdoc?.methods[functionSignature];
    const devdocItem = metadataOutput.devdoc?.methods[functionSignature];
    const userdocExpression = userdocItem && userdocItem.notice && await this.fillNatSpecExpression(userdocItem.notice, metadataOutput.abi, hexTxInput);
    const devdocExpression = devdocItem && devdocItem.details && await this.fillNatSpecExpression(devdocItem.details, metadataOutput.abi, hexTxInput);

    return {
        functionName: functionAbiItem.name,
        params,
        userdoc: userdocItem && {...userdocItem, notice: userdocExpression},
        devdoc: devdocItem && {...devdocItem, details: devdocExpression}
      };
  }

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
  generateFunctionSignature(functionAbiItem: AbiItem): string {
    const typeNamesStr = functionAbiItem.inputs.map(inputItem => inputItem.type).join(',') // e.g. 'address,uint26,uint8' or '' if empty
    return `${functionAbiItem.name}(${typeNamesStr})`;
  }

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
  findAbiItemFromSignatureHash(functionSignatureHash: string, abi: AbiItem[]): AbiItem {
    // Generate function signature hashes in the abi
    const abiFunctionSignatureHashes = abi.map((abiFunc => {
      // skip non functions e.g. constructor, event
      if (abiFunc.type !== 'function') {
        return '';
      }
      return this.web3.eth.abi.encodeFunctionSignature(abiFunc);
    }))

    const calledFunctionIndex = abiFunctionSignatureHashes.indexOf(functionSignatureHash);
    if (calledFunctionIndex === -1) {
      throw new Error(`Couldn't find the function with signature ${functionSignatureHash} in the given abi`)
    }
    return abi[calledFunctionIndex];
  }

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
  fillNatSpecExpression(expression: string, abi: AbiItem[], txData: string): string {
    const call = {
      abi: abi,
      transaction: {
        data: txData
      }
    }
    const messagePromise = evaluate(expression, call)
    return messagePromise;
  }
}