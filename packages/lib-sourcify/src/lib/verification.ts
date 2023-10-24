import { CheckedContract } from './CheckedContract';
import {
  /* ContextVariables, */
  Create2Args,
  ImmutableReferences,
  ImmutablesTransformation,
  Match,
  Metadata,
  AuxdataTransformation,
  RecompilationResult,
  StringMap,
  Transformation,
  LibraryTransformation,
  ConstructorTransformation,
  CallProtectionTransformation,
  TransformationValues,
} from './types';
import {
  decode as bytecodeDecode,
  splitAuxdata,
} from '@ethereum-sourcify/bytecode-utils';
import { getAddress, getCreateAddress, keccak256 } from 'ethers';
/* 
import { EVM } from '@ethereumjs/evm';
import { EEI } from '@ethereumjs/vm';
import { Address } from '@ethereumjs/util';
import { Common } from '@ethereumjs/common';
import { DefaultStateManager } from '@ethereumjs/statemanager';
import { Blockchain } from '@ethereumjs/blockchain';
*/
import { hexZeroPad, isHexString } from '@ethersproject/bytes';
import { BigNumber } from '@ethersproject/bignumber';
import semverSatisfies from 'semver/functions/satisfies';
import { defaultAbiCoder as abiCoder, ParamType } from '@ethersproject/abi';
import { AbiConstructor } from 'abitype';
import { logInfo, logWarn } from './logger';
import SourcifyChain from './SourcifyChain';
import { lt } from 'semver';

export async function verifyDeployed(
  checkedContract: CheckedContract,
  sourcifyChain: SourcifyChain,
  address: string,
  /* _contextVariables?: ContextVariables, */
  creatorTxHash?: string,
  forceEmscripten = false
): Promise<Match> {
  let match: Match = {
    address,
    chainId: sourcifyChain.chainId.toString(),
    runtimeMatch: null,
    creationMatch: null,
    runtimeTransformations: [],
    creationTransformations: [],
    runtimeTransformationValues: {},
    creationTransformationValues: {},
  };
  logInfo(
    `Verifying contract ${
      checkedContract.name
    } at address ${address} on chain ${sourcifyChain.chainId.toString()}`
  );

  let useEmscripten = forceEmscripten;

  // See https://github.com/ethereum/sourcify/issues/1159
  // The nightlies and pre-0.4.10 platform binaries are not available
  if (
    lt(checkedContract.metadata.compiler.version, '0.4.10') ||
    checkedContract.metadata.compiler.version.includes('nightly')
  ) {
    useEmscripten = true;
  }

  const recompiled = await checkedContract.recompile(useEmscripten);

  if (
    recompiled.runtimeBytecode === '0x' ||
    recompiled.creationBytecode === '0x'
  ) {
    throw new Error(
      `The compiled contract bytecode is "0x". Are you trying to verify an abstract contract?`
    );
  }

  const runtimeBytecode = await sourcifyChain.getBytecode(address);

  // Can't match if there is no deployed bytecode
  if (!runtimeBytecode) {
    match.message = `Chain #${sourcifyChain.chainId} is temporarily unavailable.`;
    return match;
  } else if (runtimeBytecode === '0x') {
    match.message = `Chain #${sourcifyChain.chainId} does not have a contract deployed at ${address}.`;
    return match;
  }

  // Try to match with deployed bytecode directly
  try {
    matchWithRuntimeBytecode(
      match,
      recompiled.runtimeBytecode,
      runtimeBytecode,
      recompiled.immutableReferences
    );
    if (match.runtimeMatch === 'partial') {
      match = await tryToFindPerfectMetadataAndMatch(
        checkedContract,
        runtimeBytecode,
        match,
        async (match, recompiled) => {
          matchWithRuntimeBytecode(
            match,
            recompiled.runtimeBytecode,
            runtimeBytecode
          );
        },
        'runtimeMatch'
      );
    }
  } catch (e: any) {
    logWarn(
      `Error while matching with runtime bytecode for contract ${address} on chain ${sourcifyChain.chainId}: ` +
        e.message
    );
  }

  try {
    // Try to match with creationTx, if available
    if (creatorTxHash) {
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);
      await matchWithCreationTx(
        match,
        recompiled.creationBytecode,
        sourcifyChain,
        address,
        creatorTxHash,
        recompiledMetadata
      );
      if (match.runtimeMatch === 'partial') {
        match = await tryToFindPerfectMetadataAndMatch(
          checkedContract,
          runtimeBytecode,
          match,
          async (match, recompiled) => {
            await matchWithCreationTx(
              match,
              recompiled.creationBytecode,
              sourcifyChain,
              address,
              creatorTxHash,
              recompiledMetadata
            );
          },
          'creationMatch'
        );
      }
    }
  } catch (e: any) {
    logWarn(
      `Error while matching with creation tx for contract ${address} on chain ${sourcifyChain.chainId}: ` +
        e.message
    );
  }

  // Case when extra unused files in compiler input cause different bytecode (https://github.com/ethereum/sourcify/issues/618)
  try {
    if (
      match.runtimeMatch === null &&
      match.creationMatch === null &&
      semverSatisfies(
        checkedContract.metadata.compiler.version,
        '=0.6.12 || =0.7.0'
      ) &&
      checkedContract.metadata.settings.optimizer?.enabled
    ) {
      const [, deployedAuxdata] = splitAuxdata(runtimeBytecode);
      const [, recompiledAuxdata] = splitAuxdata(recompiled.runtimeBytecode);
      // Metadata hashes match but bytecodes don't match.
      if (deployedAuxdata === recompiledAuxdata) {
        (match as Match).runtimeMatch = 'extra-file-input-bug';
        (match as Match).message =
          'It seems your contract has either Solidity v0.6.12 or v0.7.0, and the metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618';
        return match;
      }
    }
  } catch (e: any) {
    logWarn(
      `Error while checking for extra-file-input-bug for contract ${address} on chain ${sourcifyChain.chainId}: ` +
        e.message
    );
  }

  try {
    // Handle when <0.8.21 and with viaIR and with optimizer disabled https://github.com/ethereum/sourcify/issues/1088
    if (
      match.runtimeMatch === null &&
      match.creationMatch === null &&
      lt(checkedContract.metadata.compiler.version, '0.8.21') &&
      !checkedContract.metadata.settings.optimizer?.enabled &&
      checkedContract.metadata.settings?.viaIR
    ) {
      logInfo(
        `Forcing compiling with the Emscripten compiler to match the deployed bytecode for ${
          checkedContract.name
        } to verify at ${address} on chain ${sourcifyChain.chainId.toString()}: `
      );
      return verifyDeployed(
        checkedContract,
        sourcifyChain,
        address,
        creatorTxHash,
        true // Force compiling with Emscripten compiler
      );
    }
  } catch (e: any) {
    logWarn(
      `Error while handling "<0.8.21 and viaIR" bug for contract ${address} on chain ${sourcifyChain.chainId}: ` +
        e.message
    );
  }

  if (match.creationMatch !== null || match.runtimeMatch !== null) {
    return match;
  }
  throw Error("The deployed and recompiled bytecode don't match.");
}

async function tryToFindPerfectMetadataAndMatch(
  checkedContract: CheckedContract,
  runtimeBytecode: string,
  match: Match,
  matchFunction: (
    match: Match,
    recompilationResult: RecompilationResult
  ) => Promise<void>,
  matchType: 'runtimeMatch' | 'creationMatch'
): Promise<Match> {
  const checkedContractWithPerfectMetadata =
    await checkedContract.tryToFindPerfectMetadata(runtimeBytecode);
  if (checkedContractWithPerfectMetadata) {
    // If found try to match again with the passed matchFunction
    const matchWithPerfectMetadata = { ...match };
    const recompiled = await checkedContractWithPerfectMetadata.recompile();

    await matchFunction(matchWithPerfectMetadata, recompiled);
    if (matchWithPerfectMetadata[matchType] === 'perfect') {
      // Replace the metadata and solidity files that will be saved in the repo
      checkedContract.initSolcJsonInput(
        checkedContractWithPerfectMetadata.metadata,
        checkedContractWithPerfectMetadata.solidity
      );
      return matchWithPerfectMetadata;
    }
  }
  return match;
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
    runtimeMatch: 'perfect',
    creationMatch: null,
    abiEncodedConstructorArguments,
    create2Args,
    runtimeTransformations: [],
    creationTransformations: [],
    runtimeTransformationValues: {},
    creationTransformationValues: {},
    // libraryMap: libraryMap,
  };

  return match;
}

export function matchWithRuntimeBytecode(
  match: Match,
  recompiledRuntimeBytecode: string,
  onchainRuntimeBytecode: string,
  immutableReferences?: ImmutableReferences
) {
  // Updating the `match.onchainRuntimeBytecode` here so we are sure to always update it
  match.onchainRuntimeBytecode = onchainRuntimeBytecode;

  if (match.runtimeTransformations === undefined) {
    match.runtimeTransformations = [];
  }
  if (match.runtimeTransformationValues === undefined) {
    match.runtimeTransformationValues = {};
  }

  // Check if is a library with call protection
  // See https://docs.soliditylang.org/en/v0.8.19/contracts.html#call-protection-for-libraries
  // Replace the call protection with the real address
  recompiledRuntimeBytecode = checkCallProtectionAndReplaceAddress(
    recompiledRuntimeBytecode,
    onchainRuntimeBytecode,
    match.runtimeTransformations,
    match.runtimeTransformationValues
  );

  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = addLibraryAddresses(
    recompiledRuntimeBytecode,
    onchainRuntimeBytecode,
    match.runtimeTransformations
  );
  recompiledRuntimeBytecode = replaced;
  match.runtimeTransformationValues.libraries = libraryMap;

  if (immutableReferences) {
    onchainRuntimeBytecode = replaceImmutableReferences(
      immutableReferences,
      onchainRuntimeBytecode,
      match.runtimeTransformations,
      match.runtimeTransformationValues
    );
  }

  if (recompiledRuntimeBytecode === onchainRuntimeBytecode) {
    match.libraryMap = libraryMap;
    match.immutableReferences = immutableReferences;
    // if the bytecode doesn't contain metadata then "partial" match
    if (endsWithMetadataHash(onchainRuntimeBytecode)) {
      match.runtimeMatch = 'perfect';
    } else {
      match.runtimeMatch = 'partial';
    }
  } else {
    // Try to match without the metadata hashes
    const [trimmedOnchainRuntimeBytecode, auxdata] = splitAuxdata(
      onchainRuntimeBytecode
    );
    const [trimmedRecompiledRuntimeBytecode] = splitAuxdata(
      recompiledRuntimeBytecode
    );
    if (trimmedOnchainRuntimeBytecode === trimmedRecompiledRuntimeBytecode) {
      match.libraryMap = libraryMap;
      match.immutableReferences = immutableReferences;
      match.runtimeMatch = 'partial';
      match.runtimeTransformations?.push(
        AuxdataTransformation(trimmedRecompiledRuntimeBytecode.length, '0')
      );
      match.runtimeTransformationValues.cborAuxdata = { '0': auxdata };
    }
  }
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
  creatorTxHash: string,
  recompiledMetadata: Metadata
) {
  if (recompiledCreationBytecode === '0x') {
    match.creationMatch = null;
    match.message = `Failed to match with creation bytecode: recompiled contract's creation bytecode is empty`;
    return;
  }

  const creatorTx = await sourcifyChain.getTx(creatorTxHash);
  let onchainCreationBytecode = '';
  try {
    onchainCreationBytecode =
      (await sourcifyChain.getContractCreationBytecode(
        address,
        creatorTxHash
      )) || '';
  } catch (e: any) {
    logWarn(
      `Failed to get contract creation bytecode for ${address} on chain ${sourcifyChain.chainId.toString()}. \n ${
        e.message
      }`
    );
    match.creationMatch = null;
    match.message = `Failed to match with creation bytecode: couldn't get the creation bytecode.`;
    return;
  }
  match.creatorTxHash = creatorTxHash;
  match.onchainCreationBytecode = onchainCreationBytecode;

  // Initialize the transformations array if undefined
  if (match.creationTransformations === undefined) {
    match.creationTransformations = [];
  }
  if (match.creationTransformationValues === undefined) {
    match.creationTransformationValues = {};
  }

  // The reason why this uses `startsWith` instead of `===` is that creationTxData may contain constructor arguments at the end part.
  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = addLibraryAddresses(
    recompiledCreationBytecode,
    onchainCreationBytecode,
    match.creationTransformations
  );
  recompiledCreationBytecode = replaced;
  match.creationTransformationValues.libraries = libraryMap;

  if (onchainCreationBytecode.startsWith(recompiledCreationBytecode)) {
    // if the bytecode doesn't end with metadata then "partial" match
    if (endsWithMetadataHash(recompiledCreationBytecode)) {
      match.creationMatch = 'perfect';
    } else {
      match.creationMatch = 'partial';
    }
  } else {
    // Match without metadata hashes
    // TODO: Handle multiple metadata hashes

    // Assuming the onchain and recompiled auxdata lengths are the same
    const onchainCreationBytecodeWithoutConstructorArgs =
      onchainCreationBytecode.slice(0, recompiledCreationBytecode.length);

    const [trimmedOnchainCreationBytecode, auxdata] = splitAuxdata(
      onchainCreationBytecodeWithoutConstructorArgs
    ); // In the case of creationTxData (not runtime bytecode) it is actually not CBOR encoded at the end because of the appended constr. args., but splitAuxdata returns the whole bytecode if it's not CBOR encoded, so will work with startsWith.
    const [trimmedRecompiledCreationBytecode] = splitAuxdata(
      recompiledCreationBytecode
    );
    if (
      trimmedOnchainCreationBytecode.startsWith(
        trimmedRecompiledCreationBytecode
      )
    ) {
      match.creationMatch = 'partial';
      match.creationTransformations?.push(
        AuxdataTransformation(trimmedRecompiledCreationBytecode.length, '0')
      );
      match.creationTransformationValues.cborAuxdata = { '0': auxdata };
    }

    // TODO: If we still don't have a match and we have multiple auxdata in legacyAssembly, try finding the metadata hashes and match with this info.
  }

  if (match.creationMatch) {
    const abiEncodedConstructorArguments =
      extractAbiEncodedConstructorArguments(
        onchainCreationBytecode,
        recompiledCreationBytecode
      );
    const constructorAbiParamInputs = (
      recompiledMetadata?.output?.abi?.find(
        (param) => param.type === 'constructor'
      ) as AbiConstructor
    )?.inputs as ParamType[];
    if (abiEncodedConstructorArguments) {
      if (!constructorAbiParamInputs) {
        match.creationMatch = null;
        match.message = `Failed to match with creation bytecode: constructor ABI Inputs are missing`;
        return;
      }
      // abiCoder doesn't break if called with a wrong `abiEncodedConstructorArguments`
      // so in order to successfuly check if the constructor arguments actually match
      // we need to re-encode it and compare them
      const decodeResult = abiCoder.decode(
        constructorAbiParamInputs,
        abiEncodedConstructorArguments
      );
      const encodeResult = abiCoder.encode(
        constructorAbiParamInputs,
        decodeResult
      );
      if (encodeResult !== abiEncodedConstructorArguments) {
        match.creationMatch = null;
        match.message = `Failed to match with creation bytecode: constructor arguments ABI decoding failed ${encodeResult} vs ${abiEncodedConstructorArguments}`;
        return;
      }

      match.creationTransformations?.push(
        ConstructorTransformation(recompiledCreationBytecode.length)
      );
      match.creationTransformationValues.constructorArguments =
        abiEncodedConstructorArguments;
    }

    // we need to check if this contract creation tx actually yields the same contract address https://github.com/ethereum/sourcify/issues/887
    const createdContractAddress = getCreateAddress({
      from: creatorTx.from,
      nonce: creatorTx.nonce,
    });
    if (createdContractAddress.toLowerCase() !== address.toLowerCase()) {
      match.creationMatch = null;
      match.message = `The address being verified ${address} doesn't match the expected ddress of the contract ${createdContractAddress} that will be created by the transaction ${creatorTxHash}.`;
      return;
    }
    match.libraryMap = libraryMap;

    match.abiEncodedConstructorArguments = abiEncodedConstructorArguments;
  }
}

export function addLibraryAddresses(
  template: string,
  real: string,
  transformationsArray: Transformation[]
): {
  replaced: string;
  libraryMap: StringMap;
} {
  const PLACEHOLDER_START = '__';
  const PLACEHOLDER_LENGTH = 40;

  const libraryMap: StringMap = {};

  let index = template.indexOf(PLACEHOLDER_START);
  while (index !== -1) {
    const placeholder = template.slice(index, index + PLACEHOLDER_LENGTH);
    const address = real.slice(index, index + PLACEHOLDER_LENGTH);
    libraryMap[placeholder] = address;

    // Replace regex with simple string replacement
    template = template.split(placeholder).join(address);

    index = template.indexOf(PLACEHOLDER_START);

    transformationsArray.push(LibraryTransformation(index, template));
  }

  return {
    replaced: template,
    libraryMap,
  };
}

// returns the full bytecode with the call protection replaced with the real address
export function checkCallProtectionAndReplaceAddress(
  template: string,
  real: string,
  transformationsArray: Transformation[],
  transformationValues: TransformationValues
): string {
  const push20CodeOp = '73';
  const callProtection = `0x${push20CodeOp}${'00'.repeat(20)}`;

  if (template.startsWith(callProtection)) {
    const replacedCallProtection = real.slice(0, 0 + callProtection.length);
    transformationsArray.push(CallProtectionTransformation());
    transformationValues.callProtection = replacedCallProtection;

    return replacedCallProtection + template.substring(callProtection.length);
  }
  return template;
}

/**
 * Replaces the values of the immutable variables in the (onchain) deployed bytecode with zeros, so that the bytecode can be compared with the (offchain) recompiled bytecode.
 * Easier this way because we can simply replace with zeros
 * Example immutableReferences: {"97":[{"length":32,"start":137}],"99":[{"length":32,"start":421}]} where 97 and 99 are the AST ids
 */
export function replaceImmutableReferences(
  immutableReferences: ImmutableReferences,
  onchainRuntimeBytecode: string,
  transformationsArray: Transformation[],
  transformationValues: TransformationValues
) {
  onchainRuntimeBytecode = onchainRuntimeBytecode.slice(2); // remove "0x"

  Object.keys(immutableReferences).forEach((astId) => {
    immutableReferences[astId].forEach((reference) => {
      const { start, length } = reference;

      // Save the transformation
      transformationsArray.push(ImmutablesTransformation(start * 2, astId));
      const immutableValue = onchainRuntimeBytecode.slice(
        start * 2,
        start * 2 + length * 2
      );

      // Save the transformation value
      if (transformationValues.immutables === undefined) {
        transformationValues.immutables = {};
      }
      transformationValues.immutables[astId] = immutableValue;

      // Write zeros in the place
      const zeros = '0'.repeat(length * 2);
      onchainRuntimeBytecode =
        onchainRuntimeBytecode.slice(0, start * 2) +
        zeros +
        onchainRuntimeBytecode.slice(start * 2 + length * 2);
    });
  });
  return '0x' + onchainRuntimeBytecode;
}

function extractAbiEncodedConstructorArguments(
  onchainCreationBytecode: string,
  compiledCreationBytecode: string
) {
  if (onchainCreationBytecode.length === compiledCreationBytecode.length)
    return undefined;

  return '0x' + onchainCreationBytecode.slice(compiledCreationBytecode.length);
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
export function calculateCreate2Address(
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

  const address = `0x${keccak256(
    `0x${['ff', deployerAddress, saltToHex(salt), keccak256(initcode)]
      .map((x) => x.replace(/0x/, ''))
      .join('')}`
  ).slice(-40)}`; // last 20 bytes
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
function endsWithMetadataHash(bytecode: string) {
  let endsWithMetadata: boolean;
  try {
    const decodedCBOR = bytecodeDecode(bytecode);
    endsWithMetadata =
      !!decodedCBOR.ipfs || !!decodedCBOR['bzzr0'] || !!decodedCBOR['bzzr1'];
  } catch (e) {
    logInfo("Can't decode CBOR");
    endsWithMetadata = false;
  }
  return endsWithMetadata;
}
