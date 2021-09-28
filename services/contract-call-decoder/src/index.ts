import cbor from 'cbor';
import Web3 from 'web3';
import multihashes from 'multihashes';

interface Processor {
    origin: string,
    process: (bytes: Buffer) => string
}

const bytesToHashProcessors: Processor[] = [
    { origin: "ipfs", process: multihashes.toB58String },
    { origin: "bzzr0", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }, // convert buffer to number[] with [...data]
    { origin: "bzzr1", process: (data) => Web3.utils.bytesToHex([...data]).slice(2) }
]

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
  static async decodeMetadataHash(hexStringByteCode: string): Promise<any> {
      const numArrayByteCode = Web3.utils.hexToBytes(hexStringByteCode);
      const cborLength: number = numArrayByteCode[numArrayByteCode.length - 2] * 0x100 + numArrayByteCode[numArrayByteCode.length - 1];
      const bytecodeBuffer = Buffer.from(numArrayByteCode.slice(numArrayByteCode.length - 2 - cborLength, -2));
      const bufferObject = await cbor.decodeFirst(bytecodeBuffer);
      for (const processor of bytesToHashProcessors) {
        const origin = processor.origin;
        if (bufferObject[origin])
          return processor.process(bufferObject[origin])
      }
      throw new Error(`Couldn't decode the hash format: ${origin}`);
  }
}