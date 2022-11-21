import radspec from '@blossom-labs/rosette-radspec';
import { Transaction as TransactionRosette } from '@blossom-labs/rosette-radspec/dist/declarations/src/types/web3';
import { decode as decodeBytecode } from '@ethereum-sourcify/bytecode-utils';
import { Interface } from '@ethersproject/abi';
import { EthereumProvider } from 'ethereum-provider';

type Transaction = TransactionRosette & {
  readonly chainId?: number;
};

require('isomorphic-fetch');

export enum MetadataSources {
  Sourcify,
  BytecodeMetadata,
}

type GetMetadataOptions = {
  readonly source?: MetadataSources;
  readonly chainId?: number;
  readonly address?: string;
  readonly rpcProvider?: EthereumProvider;
  readonly ipfsGateway?: string;
  readonly sourcifyProvider?: string;
};

const defaultGetMetadataOptions: GetMetadataOptions = {
  source: MetadataSources.Sourcify,
  sourcifyProvider: 'https://repo.sourcify.dev',
  ipfsGateway: 'https://cloudflare-ipfs.com/',
};

export async function getMetadataFromAddress(options: GetMetadataOptions) {
  options = { ...defaultGetMetadataOptions, ...options };
  // eslint-disable-next-line functional/no-let
  let contractMetadataJSON;
  if (options.source === MetadataSources.Sourcify) {
    try {
      const req = await fetch(
        `${options.sourcifyProvider}/contracts/full_match/${options.chainId}/${options.address}/metadata.json`
      );
      contractMetadataJSON = await req.json();
    } catch (e) {
      console.log(e);
      return false;
    }
  } else if (options.source === MetadataSources.BytecodeMetadata) {
    const bytecode = (await options.rpcProvider.request({
      method: 'eth_getCode',
      params: [options.address, 'latest'],
    })) as string;
    if (!bytecode || bytecode === '0x') {
      return false;
    }
    const { ipfs: metadataIpfsCid } = decodeBytecode(bytecode);
    try {
      const req = await fetch(`${options.ipfsGateway}/ipfs/${metadataIpfsCid}`);
      contractMetadataJSON = await req.json();
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  return contractMetadataJSON;
}

export const evaluate = async function name(
  expression: string,
  abi,
  transaction: Transaction,
  provider?
): Promise<string> {
  return await radspec(expression, abi, transaction, provider);
};

export const findSelectorAndAbiItemFromSignatureHash = (
  functionSignatureHash,
  abi
) => {
  try {
    const interf = new Interface(abi);
    const selector = Object.keys(interf.functions).find((selector) => {
      return interf.getSighash(selector) === functionSignatureHash;
    });
    // TODO: handle error
    return {
      selector,
      abi: interf.functions[selector],
    };
  } catch (e) {
    return false;
  }
};

export const decodeContractCall = async (
  tx: Transaction,
  options: GetMetadataOptions = {}
): Promise<string | boolean> => {
  const getMetadataOptions = {
    ...defaultGetMetadataOptions,
    ...options,
    address: tx.to,
    chainId: options.chainId || tx.chainId,
  };
  const metadata = await getMetadataFromAddress(getMetadataOptions);

  const functionSignatureHash = tx.data.slice(0, 10);

  const selectorAndAbi = findSelectorAndAbiItemFromSignatureHash(
    functionSignatureHash,
    metadata.output.abi
  );
  if (!selectorAndAbi) {
    return false;
  }
  const { selector } = selectorAndAbi;

  const evaluatedString = await evaluate(
    metadata.output.userdoc.methods[selector].notice,
    metadata.output.abi,
    tx,
    getMetadataOptions.rpcProvider
  );
  return evaluatedString;
};
