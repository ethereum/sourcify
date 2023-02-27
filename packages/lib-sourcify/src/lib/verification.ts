import { CheckedContract } from './CheckedContract';
import {
  ContextVariables,
  Create2Args,
  Match,
  SourcifyChain,
  StringMap,
} from './types';
import { toChecksumAddress } from 'web3-utils';
import { Transaction } from 'web3-core';
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
import { hexZeroPad, isHexString } from '@ethersproject/bytes';
import { BigNumber } from '@ethersproject/bignumber';
import { getAddress, getContractAddress } from '@ethersproject/address';
import semverSatisfies from 'semver/functions/satisfies';

const RPC_TIMEOUT = 5000;

export async function verifyDeployed(
  checkedContract: CheckedContract,
  sourcifyChain: SourcifyChain,
  address: string,
  contextVariables?: ContextVariables,
  creatorTxHash?: string
): Promise<Match> {
  const match: Match = {
    address,
    chainId: sourcifyChain.chainId.toString(),
    status: null,
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

  // Try to match with deployed bytecode directly
  matchWithDeployedBytecode(
    match,
    recompiled.deployedBytecode,
    deployedBytecode
  );
  if (match.status) return match;

  // Try to match with simulating the creation bytecode
  await matchWithSimulation(
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

  // Try to match with creationTx, if available
  if (creatorTxHash) {
    await matchWithCreationTx(
      match,
      recompiled.creationBytecode,
      sourcifyChain,
      address,
      creatorTxHash
    );
    if (match.status) return match;
  }

  // Case when extra unused files in compiler input cause different bytecode (https://github.com/ethereum/sourcify/issues/618)
  if (
    semverSatisfies(
      checkedContract.metadata.compiler.version,
      '=0.6.12 || =0.7.0'
    ) &&
    checkedContract.metadata.settings.optimizer?.enabled
  ) {
    const [, deployedAuxdata] = splitAuxdata(deployedBytecode);
    const [, recompiledAuxdata] = splitAuxdata(recompiled.deployedBytecode);
    // Metadata hashes match but bytecodes don't match.
    if (deployedAuxdata === recompiledAuxdata) {
      match.status = 'extra-file-input-bug';
      match.message =
        'It seems your contract has either Solidity v0.6.12 or v0.7.0, and the metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618';
      return match;
    }
  }

  throw Error("The deployed and recompiled bytecode don't match.");
}

export async function verifyCreate2(
  checkedContract: CheckedContract,
  deployerAddress: string,
  salt: string,
  create2Address: string,
  abiEncodedConstructorArguments?: string
): Promise<Match> {
  const recompiled = await checkedContract.recompile();

  const computedAddr = calculateCreate2Address(
    deployerAddress,
    salt,
    recompiled.creationBytecode,
    abiEncodedConstructorArguments
  );

  if (create2Address.toLowerCase() !== computedAddr.toLowerCase()) {
    throw new Error(
      `The provided create2 address doesn't match server's generated one. Expected: ${computedAddr} ; Received: ${create2Address} ;`
    );
  }

  // TODO: Can create2 have library addresses?

  const create2Args: Create2Args = {
    deployerAddress,
    salt,
  };

  const match: Match = {
    address: computedAddr,
    chainId: '0',
    status: 'perfect',
    storageTimestamp: new Date(),
    abiEncodedConstructorArguments,
    create2Args,
    // libraryMap: libraryMap,
  };

  return match;
}

export function matchWithDeployedBytecode(
  match: Match,
  recompiledDeployedBytecode: string,
  deployedBytecode: string
) {
  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = addLibraryAddresses(
    recompiledDeployedBytecode,
    deployedBytecode
  );
  recompiledDeployedBytecode = replaced;

  if (recompiledDeployedBytecode === deployedBytecode) {
    match.libraryMap = libraryMap;

    // if the bytecode doesn't contain metadata then "partial" match
    if (doesContainMetadataHash(deployedBytecode)) {
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
      match.libraryMap = libraryMap;
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
    '0x' + result.execResult.returnValue.toString('hex');

  matchWithDeployedBytecode(
    match,
    simulationDeployedBytecode,
    deployedBytecode
  );
}
/**
 * Matches the contract via the transaction that created the contract, if that tx is known.
 * Checks if the tx.input matches the recompiled creation bytecode. Double checks that the contract address matches the address being verified.
 *
 */
export async function matchWithCreationTx(
  match: Match,
  recompiledCreationBytecode: string,
  sourcifyChain: SourcifyChain,
  address: string,
  creatorTxHash: string
) {
  const creatorTx = await getTx(creatorTxHash, sourcifyChain);
  const creatorTxData = creatorTx.input;

  // The reason why this uses `startsWith` instead of `===` is that creationTxData may contain constructor arguments at the end part.
  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = addLibraryAddresses(
    recompiledCreationBytecode,
    creatorTxData
  );
  recompiledCreationBytecode = replaced;

  if (creatorTxData.startsWith(recompiledCreationBytecode)) {
    // if the bytecode doesn't contain metadata then "partial" match
    if (doesContainMetadataHash(recompiledCreationBytecode)) {
      match.status = 'perfect';
    } else {
      match.status = 'partial';
    }
  } else {
    // Match without metadata hashes
    const [trimmedCreatorTxData] = splitAuxdata(creatorTxData); // In the case of creationTxData (not deployed bytecode) it is actually not CBOR encoded because of the appended constr. args., but splitAuxdata returns the whole bytecode if it's not CBOR encoded, so will work with startsWith.
    const [trimmedRecompiledCreationBytecode] = splitAuxdata(
      recompiledCreationBytecode
    );
    if (trimmedCreatorTxData.startsWith(trimmedRecompiledCreationBytecode)) {
      match.status = 'partial';
    }
  }

  if (match.status) {
    // we need to check if this contract creation tx actually yields the same contract address https://github.com/ethereum/sourcify/issues/887
    const createdContractAddress = getContractAddress({
      from: creatorTx.from,
      nonce: creatorTx.nonce,
    });
    if (createdContractAddress.toLowerCase() !== address.toLowerCase()) {
      match.status = null;
      match.message = `The address being verified ${address} doesn't match the expected ddress of the contract ${createdContractAddress} that will be created by the transaction ${creatorTxHash}.`;
      return;
    }
    match.libraryMap = libraryMap;
    const abiEncodedConstructorArguments =
      extractAbiEncodedConstructorArguments(
        creatorTxData,
        recompiledCreationBytecode
      );
    match.abiEncodedConstructorArguments = abiEncodedConstructorArguments;
  }
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
  if (!sourcifyChain?.rpc.length)
    throw new Error('No RPC provider was given for this chain.');
  address = toChecksumAddress(address);

  // Request sequentially. Custom node is always before ALCHEMY so we don't waste resources if succeeds.
  for (const rpcURL of sourcifyChain.rpc) {
    try {
      const web3 = rpcURL.startsWith('http')
        ? new Web3(new Web3.providers.HttpProvider(rpcURL))
        : new Web3(new Web3.providers.WebsocketProvider(rpcURL));

      if (!web3.currentProvider) throw new Error('No provider found');

      // Race the RPC call with a timeout
      const bytecode = await Promise.race([
        web3.eth.getCode(address),
        rejectInMs(RPC_TIMEOUT, rpcURL),
      ]);
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

async function getTx(creatorTxHash: string, sourcifyChain: SourcifyChain) {
  if (!sourcifyChain?.rpc.length)
    throw new Error('No RPC provider was given for this chain.');
  for (const rpcURL of sourcifyChain.rpc) {
    try {
      const web3 = rpcURL.startsWith('http')
        ? new Web3(new Web3.providers.HttpProvider(rpcURL))
        : new Web3(new Web3.providers.WebsocketProvider(rpcURL));

      if (!web3.currentProvider) throw new Error('No provider found');

      // Race the RPC call with a timeout
      const tx = (await Promise.race([
        web3.eth.getTransaction(creatorTxHash),
        rejectInMs(RPC_TIMEOUT, rpcURL),
      ])) as Transaction;
      if (tx) {
        console.log(`Transaction ${creatorTxHash} fetched via ${rpcURL}`);
        return tx;
      }
    } catch (err) {
      // Catch to try the next RPC
      console.log(err);
    }
  }
  throw new Error('None of the RPCs responded');
}

const rejectInMs = (ms: number, host: string) =>
  new Promise<string>((_resolve, reject) => {
    setTimeout(() => reject(`RPC ${host} took too long to respond`), ms);
  });

export function addLibraryAddresses(
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

function extractAbiEncodedConstructorArguments(
  onchainCreationBytecode: string,
  compiledCreationBytecode: string
) {
  if (onchainCreationBytecode.length === compiledCreationBytecode.length)
    return undefined;

  const startIndex = onchainCreationBytecode.indexOf(compiledCreationBytecode);
  return (
    '0x' +
    onchainCreationBytecode.slice(startIndex + compiledCreationBytecode.length)
  );
}

/**
 * Calculates the address of the contract created with the EIP-1014 CREATE2 opcode.
 *
 * @param deployerAddress
 * @param salt
 * @param creationBytecode
 * @param abiEncodedConstructorArguments
 * @returns Match
 */
function calculateCreate2Address(
  deployerAddress: string,
  salt: string,
  creationBytecode: string,
  abiEncodedConstructorArguments?: string
) {
  let initcode = creationBytecode;

  if (abiEncodedConstructorArguments) {
    initcode += abiEncodedConstructorArguments.startsWith('0x')
      ? abiEncodedConstructorArguments.slice(2)
      : abiEncodedConstructorArguments;
  }

  const address = `0x${Web3.utils
    .keccak256(
      `0x${[
        'ff',
        deployerAddress,
        saltToHex(salt),
        Web3.utils.keccak256(initcode),
      ]
        .map((x) => x.replace(/0x/, ''))
        .join('')}`
    )
    .slice(-40)}`; // last 20 bytes
  return getAddress(address); // checksum
}

const saltToHex = (salt: string) => {
  if (isHexString(salt)) {
    return hexZeroPad(salt, 32);
  }
  const bn = BigNumber.from(salt);
  const hex = bn.toHexString();
  const paddedHex = hexZeroPad(hex, 32);
  return paddedHex;
};

/**
 * Checks if there's a CBOR encoded metadata hash appended to the bytecode.
 *
 * @param bytecode
 * @returns bool - true if there's a metadata hash
 */
function doesContainMetadataHash(bytecode: string) {
  let containsMetadata: boolean;
  try {
    const decodedCBOR = bytecodeDecode(bytecode);
    containsMetadata =
      !!decodedCBOR.ipfs || !!decodedCBOR['bzzr0'] || !!decodedCBOR['bzzr1'];
  } catch (e) {
    console.log("Can't decode CBOR");
    containsMetadata = false;
  }
  return containsMetadata;
}
