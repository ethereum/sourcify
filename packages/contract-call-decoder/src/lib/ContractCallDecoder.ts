import radspec from '@blossom-labs/rosette-radspec';
import { Transaction as TransactionRosette } from '@blossom-labs/rosette-radspec/dist/declarations/src/types/web3';
import { decode as decodeBytecode } from '@ethereum-sourcify/bytecode-utils';
import {
  Fragment,
  FunctionFragment,
  Interface,
  JsonFragment,
} from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { EthereumProvider } from 'ethereum-provider';

import { extractCustomFields, getValueFromDecodedFunctionData } from './utils';

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
  ipfsGateway: 'https://ipfs.io',
};

export async function getMetadataFromAddress(options: GetMetadataOptions) {
  options = { ...defaultGetMetadataOptions, ...options };
  let contractMetadataJSON;
  if (options.source === MetadataSources.Sourcify) {
    if (!options.chainId) {
      throw new Error('Missing chainId while using "MetadataSources.Sourcify"');
    }
    if (!options.address) {
      throw new Error('Missing address while using "MetadataSources.Sourcify"');
    }
    const sourcifyUrl = `${options.sourcifyProvider}/contracts/full_match/${options.chainId}/${options.address}/metadata.json`;
    try {
      const req = await fetch(sourcifyUrl);
      contractMetadataJSON = await req.json();
    } catch (e) {
      throw new Error(`The contract is not available on "${sourcifyUrl}"`);
    }
  } else if (options.source === MetadataSources.BytecodeMetadata) {
    if (!options.rpcProvider) {
      throw new Error(
        `Missing rpcProvider while using "MetadataSources.BytecodeMetadata"`
      );
    }
    const bytecode = (await options?.rpcProvider?.request({
      method: 'eth_getCode',
      params: [options.address, 'latest'],
    })) as string;
    if (!bytecode || bytecode === '0x') {
      throw new Error(
        `Bytecode not found while using "MetadataSources.BytecodeMetadata"`
      );
    }
    const { ipfs: metadataIpfsCid } = decodeBytecode(bytecode);
    try {
      const req = await fetch(`${options.ipfsGateway}/ipfs/${metadataIpfsCid}`);
      contractMetadataJSON = await req.json();
    } catch (e) {
      console.log(e);
      throw new Error(
        `Cannot fetch metadata from ipfs while using "MetadataSources.BytecodeMetadata"`
      );
    }
  }

  return contractMetadataJSON;
}

export const evaluate = async function (
  expression: string,
  abi: string | ReadonlyArray<Fragment | JsonFragment | string>,
  transaction: Transaction,
  provider: Provider
): Promise<string | undefined> {
  return await radspec(expression, abi, transaction, provider);
};

export const findSelectorAndAbiItemFromSignatureHash = (
  functionSignatureHash: string,
  abi: string | ReadonlyArray<Fragment | JsonFragment | string>
) => {
  try {
    const interf = new Interface(abi);
    const selector = Object.keys(interf.functions).find((selector) => {
      return interf.getSighash(selector) === functionSignatureHash;
    });
    if (!selector) {
      return false;
    }
    return {
      selector,
      abi: interf.functions[selector],
    };
  } catch (e) {
    return false;
  }
};

type DecodedParam =
  | unknown
  | {
      readonly [index: string]: unknown;
    };

type DecodedContractCall = {
  readonly contract: {
    readonly author?: string;
    readonly title?: string;
    readonly details?: string;
    readonly custom?: {
      readonly [index: string]: string;
    };
  };
  readonly method: {
    readonly selector: string;
    readonly abi: FunctionFragment;
    readonly decodedParams: readonly DecodedParam[];
    readonly details?: string;
    readonly returns?: string;
    readonly notice?: string;
    readonly params?: { readonly [index: string]: unknown };
    readonly custom?: {
      readonly [index: string]: string;
    };
  };
};

export const decodeContractCall = async (
  tx: Transaction,
  options: GetMetadataOptions = {}
): Promise<DecodedContractCall | false> => {
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
    throw new Error(`Cannot find the function selector in the provided ABI`);
  }
  const { selector, abi } = selectorAndAbi;

  let radspecEvaluatedNotice;
  if (metadata.output?.userdoc?.methods[selector]?.notice) {
    radspecEvaluatedNotice = await evaluate(
      metadata.output.userdoc.methods[selector].notice,
      metadata.output.abi,
      tx,
      getMetadataOptions.rpcProvider as unknown as Provider
    );
  }

  let radspecEvaluatedDetails;
  if (metadata.output?.devdoc?.methods[selector]?.details) {
    radspecEvaluatedDetails = await evaluate(
      metadata.output?.devdoc?.methods[selector]?.details,
      metadata.output.abi,
      tx,
      getMetadataOptions.rpcProvider as unknown as Provider
    );
  }

  const iface = new Interface(metadata.output.abi);
  const decodedParams = iface
    .decodeFunctionData(selector, tx.data)
    .map((param) => {
      return getValueFromDecodedFunctionData(param);
    });

  const devdoc = metadata.output.devdoc;

  const customFieldsContract = extractCustomFields(devdoc);
  const customFieldsMethod = extractCustomFields(devdoc.methods[selector]);

  return {
    contract: {
      author: devdoc.author,
      title: devdoc.title,
      details: devdoc.details,
      custom: customFieldsContract,
    },
    method: {
      selector,
      abi: abi,
      details: radspecEvaluatedDetails,
      params: devdoc.methods[selector]?.params,
      returns: devdoc.methods[selector]?.returns,
      notice: radspecEvaluatedNotice,
      decodedParams,
      custom: customFieldsMethod,
    },
  };
};
