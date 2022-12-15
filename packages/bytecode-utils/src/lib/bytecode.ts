import { arrayify, hexlify } from '@ethersproject/bytes';
import bs58 from 'bs58';
import * as CBOR from 'cbor-x';

type CBOR = {
  bytes: string;
  length: number;
};

// eslint-disable-next-line functional/no-mixed-type
type DecodedObject = {
  ipfs?: string;
  solcVersion?: string;
  [key: string]: string | Uint8Array | undefined | boolean;
};

/**
 * Decode contract's bytecode
 * @param bytecode - hex of the bytecode with 0x prefix
 * @returns Object describing the contract
 */
export const decode = (bytecode: string): DecodedObject => {
  if (bytecode.length === 0) {
    throw Error('Bytecode cannot be null');
  }
  if (bytecode.substring(0, 2) !== '0x') {
    bytecode = '0x' + bytecode;
  }

  // split auxdata
  const [, auxdata] = splitAuxdata(bytecode);

  if (!auxdata) {
    throw Error('Auxdata is not in the execution bytecode');
  }

  // cbor decode the object and get a json
  const cborDecodedObject = CBOR.decode(arrayify(`0x${auxdata}`));

  const result: DecodedObject = {};

  // Decode all the parameters from the json
  Object.keys(cborDecodedObject).forEach((key: string) => {
    switch (key) {
      case 'ipfs': {
        const ipfsCID = bs58.encode(cborDecodedObject.ipfs);
        result.ipfs = ipfsCID;
        break;
      }
      case 'solc': {
        // nightly builds are string encoded
        if (typeof cborDecodedObject.solc === 'string') {
          result.solcVersion = cborDecodedObject.solc;
        } else {
          result.solcVersion = cborDecodedObject.solc.join('.');
        }
        break;
      }
      case 'experimental': {
        result.experimental = cborDecodedObject.experimental;
        break;
      }
      case 'bzzr0':
      case 'bzzr1':
      default: {
        result[key] = hexlify(cborDecodedObject[key]);
        break;
      }
    }
  });

  return result;
};

/**
 * Splits bytecode into execution bytecode and auxdata
 * If the bytecode has no CBOR encoded part, returns the whole bytecode
 * @param bytecode - hex of the bytecode with 0x prefix
 * @returns string[] - [ executionBytecode, auxdata?, cborBytesLength?] all as hexStrings
 */
export const splitAuxdata = (bytecode: string): string[] => {
  if (bytecode.length === 0) {
    throw Error('Bytecode cannot be null');
  }
  if (bytecode.substring(0, 2) !== '0x') {
    bytecode = '0x' + bytecode;
  }

  const bytesLength = 4;

  // Take latest 2 bytes of the bytecode (length of the cbor object)
  const cborLenghtHex = `${bytecode.slice(-bytesLength)}`;
  const cborLength = parseInt(cborLenghtHex, 16);
  const cborBytesLength = cborLength * 2;

  // If the length of the cbor is more or equal to the length of the execution bytecode, it means there is no cbor
  if (bytecode.length - bytesLength - cborBytesLength <= 0) {
    return [bytecode];
  }
  // Extract the cbor object using the extracted lenght
  const auxdata = bytecode.substring(
    bytecode.length - bytesLength - cborBytesLength,
    bytecode.length - bytesLength
  );

  // Extract exection bytecode
  const executionBytecode = bytecode.substring(
    0,
    bytecode.length - bytesLength - cborBytesLength
  );

  try {
    // return the complete array only if the auxdata is actually cbor encoded
    CBOR.decode(arrayify(`0x${auxdata}`));
    return [executionBytecode, auxdata, cborLenghtHex];
  } catch (e) {
    return [bytecode];
  }
};
