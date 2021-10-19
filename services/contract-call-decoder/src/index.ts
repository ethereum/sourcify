import {decodeFirst} from 'cbor';
import Web3 from 'web3';
import { toB58String } from 'multihashes';
import fetch from 'node-fetch';
import {Response} from 'node-fetch/@types';
import timeoutSignal from 'timeout-signal';

interface Processor {
    origin: string,
    process: (bytes: Buffer) => string
}

type MetadataOutput = {
  abi: Array<any>,
  userdoc: Array<any>,
  devdoc: Array<any>
}

const bytesToHashProcessors: Processor[] = [
    { origin: "ipfs", process: toB58String },
    { origin: "bzzr0", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }, // convert buffer to number[] with [...data]
    { origin: "bzzr1", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }
]

export default class ContractCallDecoder {

  ipfsGateway: string;
  web3Provider: Web3;
  timeout: number;
  
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
}
