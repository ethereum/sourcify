import { arrayify, hexlify } from '@ethersproject/bytes';
import bs58 from 'bs58';
import * as CBOR from 'cbor-x';
import { EthereumProvider } from 'ethereum-provider';

type CBOR = {
  bytes: string;
  length: number;
};

// eslint-disable-next-line functional/no-mixed-type
type DecodedObject = {
  cbor: CBOR;
  ipfs?: string;
  solcVersion?: string;
  [key: string]: string | CBOR | Uint8Array | undefined | boolean;
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
    throw Error('Bytecode should start with 0x');
  }

  // Take latest 2 bytes of the bytecode (length of the cbor object)
  const cborLength = parseInt(`${bytecode.slice(-4)}`, 16);

  // Extract the cbor object using the extracted lenght
  const cborRaw = bytecode.substring(
    bytecode.length - 4 - cborLength * 2,
    bytecode.length - 4
  );

  // cbor decode the object and get a json
  const cborDecodedObject = CBOR.decode(arrayify(`0x${cborRaw}`));

  const result: DecodedObject = {
    cbor: {
      bytes: `0x${cborRaw}`,
      length: cborLength,
    },
  };

  // Decode all the parameters from the json
  Object.keys(cborDecodedObject).forEach((key: string) => {
    switch (key) {
      case 'ipfs': {
        const ipfsCID = bs58.encode(cborDecodedObject.ipfs);
        result.ipfs = ipfsCID;
        break;
      }
      case 'solc': {
        result.solcVersion = cborDecodedObject.solc.join('.');
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
 * Get contract's bytecode given an address and an rpc
 * @param address - contract's address
 * @param provider - provider used to get the bytecode
 * @returns bytecode
 */
export const get = async (
  address: string,
  provider: EthereumProvider
): Promise<string> => {
  const bytecode = await provider.request({
    method: 'eth_getCode',
    params: [address, 'latest'],
  });
  return bytecode as string;
};
