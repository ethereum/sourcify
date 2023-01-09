import { CheckedContract } from './CheckedContract';
import { ContextVariables, Match, SourcifyChain, StringMap } from './types';
import { toChecksumAddress } from 'web3-utils';
import Web3 from 'web3';
import {
  decode as bytecodeDecode,
  splitAuxdata,
} from '@ethereum-sourcify/bytecode-utils';
import { EVM } from '@ethereumjs/evm';
import { EEI } from '@ethereumjs/vm';
import { Address } from '@ethereumjs/util';
import { Common } from '@ethereumjs/common';
import { DefaultStateManager } from '@ethereumjs/statemanager';
import { Blockchain } from '@ethereumjs/blockchain';

export async function verifyDeployed(
  checkedContract: CheckedContract,
  sourcifyChain: SourcifyChain,
  address: string,
  contextVariables?: ContextVariables
): Promise<Match> {
  const match: Match = {
    address,
    chainId: sourcifyChain.chainId.toString(),
    status: null,
    abiEncodedConstructorArguments: undefined,
    libraryMap: undefined,
  };

  const recompiled = await checkedContract.recompile();

  const deployedBytecode = await getBytecode(sourcifyChain, address);

  // Can't match if there is no deployed bytecode
  if (!deployedBytecode) {
    match.message = `Chain #${sourcifyChain.chainId} is temporarily unavailable.`;
    return match;
  } else if (deployedBytecode === '0x') {
    match.message = `Chain #${sourcifyChain.chainId} does not have a contract deployed at ${address}.`;
    return match;
  }

  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = addLibraryAddresses(
    recompiled.deployedBytecode,
    deployedBytecode
  );
  recompiled.deployedBytecode = replaced;
  match.libraryMap = libraryMap;

  // Try to match with deployed bytecode directly
  matchWithDeployedBytecode(
    match,
    recompiled.deployedBytecode,
    deployedBytecode
  );
  if (match.status) return match;

  // Try to match with simulating the creation bytecode
  matchWithSimulation(
    match,
    recompiled.creationBytecode,
    deployedBytecode,
    checkedContract.metadata.settings.evmVersion,
    sourcifyChain.chainId.toString(),
    contextVariables
  );
  if (match.status) {
    match.contextVariables = contextVariables;
    return match;
  }
  return match;
}

export async function matchWithDeployedBytecode(
  match: Match,
  recompiledDeployedBytecode: string,
  deployedBytecode: string
) {
  if (recompiledDeployedBytecode === deployedBytecode) {
    // if the bytecode doesn't contain metadata then "partial" match
    let containsMetadata;
    try {
      const decodedCBOR = bytecodeDecode(deployedBytecode);
      containsMetadata =
        !!decodedCBOR.ipfs || !!decodedCBOR['bzzr0'] || !!decodedCBOR['bzzr1'];
    } catch (e) {
      console.log("Can't decode CBOR");
      containsMetadata = false;
    }

    if (containsMetadata) {
      match.status = 'perfect';
    } else {
      match.status = 'partial';
    }
  } else {
    // Try to match without the metadata hashes
    const [trimmedDeployedBytecode] = splitAuxdata(deployedBytecode);
    const [trimmedCompiledRuntimeBytecode] = splitAuxdata(
      recompiledDeployedBytecode
    );
    if (trimmedDeployedBytecode === trimmedCompiledRuntimeBytecode) {
      match.status = 'partial';
    }
  }
}

export async function matchWithSimulation(
  match: Match,
  recompiledCreaionBytecode: string,
  deployedBytecode: string,
  evmVersion: string,
  chainId: string,
  contextVariables?: ContextVariables
) {
  let { abiEncodedConstructorArguments } = contextVariables || {};
  const { msgSender } = contextVariables || {};

  const stateManager = new DefaultStateManager();
  const blockchain = await Blockchain.create();
  const common = Common.custom({
    chainId: parseInt(chainId),
    defaultHardfork: evmVersion,
  });
  const eei = new EEI(stateManager, common, blockchain);

  const evm = new EVM({
    common,
    eei,
  });
  if (recompiledCreaionBytecode.startsWith('0x')) {
    recompiledCreaionBytecode = recompiledCreaionBytecode.slice(2);
  }
  if (abiEncodedConstructorArguments?.startsWith('0x')) {
    abiEncodedConstructorArguments = abiEncodedConstructorArguments.slice(2);
  }
  const initcode = Buffer.from(
    recompiledCreaionBytecode +
      (abiEncodedConstructorArguments ? abiEncodedConstructorArguments : ''),
    'hex'
  );

  const result = await evm.runCall({
    data: initcode,
    gasLimit: BigInt(0xffffffffff),
    // prettier vs. eslint indentation conflict here
    /* eslint-disable indent */
    caller: msgSender
      ? new Address(
          Buffer.from(
            msgSender.startsWith('0x') ? msgSender.slice(2) : msgSender,
            'hex'
          )
        )
      : undefined,
    /* eslint-enable indent */
  });
  const simulationDeployedBytecode =
    result.execResult.returnValue.toString('hex');

  matchWithDeployedBytecode(
    match,
    simulationDeployedBytecode,
    deployedBytecode
  );
}

/**
 * Fetches the contract's deployed bytecode from SourcifyChain's rpc's.
 * Tries to fetch sequentially if the first RPC is a local eth node. Fetches in parallel otherwise.
 *
 * @param {SourcifyChain} sourcifyChain - chain object with rpc's
 * @param {string} address - contract address
 */
export async function getBytecode(
  sourcifyChain: SourcifyChain,
  address: string
): Promise<string> {
  const RPC_TIMEOUT = 5000;

  if (!sourcifyChain?.rpc.length)
    throw new Error('No RPC provider was given for this chain.');
  address = toChecksumAddress(address);

  // Request sequentially. Custom node is always before ALCHEMY so we don't waste resources if succeeds.
  for (const rpcURL of sourcifyChain.rpc) {
    try {
      const bytecode = await raceWithTimeout(rpcURL, RPC_TIMEOUT, address);
      if (bytecode) {
        console.log(
          `Execution bytecode fetched from address ${address} via ${rpcURL}`
        );
      }
      return bytecode;
    } catch (err) {
      // Catch to try the next RPC
      console.log(err);
    }
  }
  throw new Error('None of the RPCs responded');
}

// Races the web3.eth.getCode call with a timeout promise. Returns a wrapper Promise that rejects if getCode call takes longer than timeout.
function raceWithTimeout(rpcURL: string, timeout: number, address: string) {
  const web3 = rpcURL.startsWith('http')
    ? new Web3(new Web3.providers.HttpProvider(rpcURL))
    : new Web3(new Web3.providers.WebsocketProvider(rpcURL));

  if (!web3.currentProvider) throw new Error('No provider found');

  return Promise.race([web3.eth.getCode(address), rejectInMs(timeout, rpcURL)]);
}

const rejectInMs = (ms: number, host: string) =>
  new Promise<string>((_resolve, reject) => {
    setTimeout(() => reject(`RPC ${host} took too long to respond`), ms);
  });

function addLibraryAddresses(
  template: string,
  real: string
): {
  replaced: string;
  libraryMap: StringMap;
} {
  const PLACEHOLDER_START = '__$';
  const PLACEHOLDER_LENGTH = 40;

  const libraryMap: StringMap = {};

  let index = template.indexOf(PLACEHOLDER_START);
  for (; index !== -1; index = template.indexOf(PLACEHOLDER_START)) {
    const placeholder = template.slice(index, index + PLACEHOLDER_LENGTH);
    const address = real.slice(index, index + PLACEHOLDER_LENGTH);
    libraryMap[placeholder] = address;
    const regexCompatiblePlaceholder = placeholder
      .replace('__$', '__\\$')
      .replace('$__', '\\$__');
    const regex = RegExp(regexCompatiblePlaceholder, 'g');
    template = template.replace(regex, address);
  }

  return {
    replaced: template,
    libraryMap,
  };
}
