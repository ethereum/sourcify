import { SolidityCheckedContract } from './SolidityCheckedContract';
import {
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
  CompiledContractCborAuxdata,
  LinkReferences,
} from './types';
import {
  AuxdataStyle,
  decode as bytecodeDecode,
  splitAuxdata,
} from '@ethereum-sourcify/bytecode-utils';
import { getAddress, keccak256, id as keccak256Str } from 'ethers';
import { hexZeroPad, isHexString } from '@ethersproject/bytes';
import { BigNumber } from '@ethersproject/bignumber';
import { defaultAbiCoder as abiCoder, ParamType } from '@ethersproject/abi';
import { AbiConstructor } from 'abitype';
import { logDebug, logError, logInfo, logWarn } from './logger';
import SourcifyChain from './SourcifyChain';
import { lt } from 'semver';
import { replaceBytecodeAuxdatasWithZeros } from './utils';
import { AbstractCheckedContract } from './AbstractCheckedContract';

export async function verifyDeployed(
  checkedContract: AbstractCheckedContract,
  sourcifyChain: SourcifyChain,
  address: string,
  creatorTxHash?: string,
  forceEmscripten = false,
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
  logInfo('Verifying contract', {
    name: checkedContract.name,
    address,
    chainId: sourcifyChain.chainId,
  });

  let useEmscripten = forceEmscripten;

  // See https://github.com/ethereum/sourcify/issues/1159
  // The nightlies and pre-0.4.10 platform binaries are not available
  if (
    checkedContract instanceof SolidityCheckedContract &&
    (lt(checkedContract.metadata.compiler.version, '0.4.10') ||
      checkedContract.metadata.compiler.version.includes('nightly'))
  ) {
    useEmscripten = true;
  }

  const recompiled = await checkedContract.recompile(useEmscripten);

  if (
    recompiled.runtimeBytecode === '0x' ||
    recompiled.creationBytecode === '0x'
  ) {
    throw new Error(
      `The compiled contract bytecode is "0x". Are you trying to verify an abstract contract?`,
    );
  }

  const runtimeBytecode = await sourcifyChain.getBytecode(address);

  // Can't match if there is no deployed bytecode
  if (!runtimeBytecode) {
    match.message = `Chain #${sourcifyChain.chainId} is temporarily unavailable`;
    logDebug('Unable to verify', {
      address,
      chainId: sourcifyChain.chainId,
      matchMessage: match.message,
    });
    return match;
  } else if (runtimeBytecode === '0x') {
    match.message = `Chain #${sourcifyChain.chainId} does not have a contract deployed at ${address}.`;
    logDebug('Unable to verify', {
      address,
      chainId: sourcifyChain.chainId,
      matchMessage: match.message,
    });
    return match;
  }

  const generateRuntimeCborAuxdataPositions = async () => {
    if (!checkedContract.runtimeBytecodeCborAuxdata) {
      await checkedContract.generateCborAuxdataPositions();
    }
    return checkedContract.runtimeBytecodeCborAuxdata || {};
  };

  // Try to match with deployed bytecode directly
  try {
    logDebug('Matching with deployed bytecode', {
      chain: sourcifyChain.chainId,
      address,
    });
    await matchWithRuntimeBytecode(
      match,
      recompiled.runtimeBytecode,
      runtimeBytecode,
      generateRuntimeCborAuxdataPositions,
      recompiled.immutableReferences,
      recompiled.runtimeLinkReferences,
      checkedContract.auxdataStyle,
    );
    if (match.runtimeMatch === 'partial') {
      logDebug('Matched with deployed bytecode', {
        chain: sourcifyChain.chainId,
        address,
        runtimeMatch: match.runtimeMatch,
      });
      if (checkedContract instanceof SolidityCheckedContract) {
        match = await tryToFindPerfectMetadataAndMatch(
          checkedContract,
          runtimeBytecode,
          match,
          async (match, recompiled) => {
            await matchWithRuntimeBytecode(
              match,
              recompiled.runtimeBytecode,
              runtimeBytecode,
              generateRuntimeCborAuxdataPositions,
              recompiled.immutableReferences,
              recompiled.runtimeLinkReferences,
              checkedContract.auxdataStyle,
            );
          },
          'runtimeMatch',
        );
      }
    }
  } catch (e: any) {
    logWarn('Error matching with runtime bytecode', {
      chain: sourcifyChain.chainId,
      address,
      error: e.message,
    });
  }

  const generateCreationCborAuxdataPositions = async () => {
    if (!checkedContract.creationBytecodeCborAuxdata) {
      await checkedContract.generateCborAuxdataPositions();
    }
    return checkedContract.creationBytecodeCborAuxdata || {};
  };

  try {
    // Try to match with creationTx, if available
    if (creatorTxHash) {
      logDebug('Matching with creation tx', {
        chain: sourcifyChain.chainId,
        address,
        creatorTxHash,
      });
      const recompiledMetadata: Metadata = JSON.parse(recompiled.metadata);
      await matchWithCreationTx(
        match,
        recompiled.creationBytecode,
        sourcifyChain,
        address,
        creatorTxHash,
        recompiledMetadata,
        generateCreationCborAuxdataPositions,
        recompiled.creationLinkReferences,
      );
      if (match.creationMatch === 'partial') {
        logDebug('Matched partial with creation tx', {
          chain: sourcifyChain.chainId,
          address,
          creationMatch: match.creationMatch,
          creatorTxHash,
        });
        if (checkedContract instanceof SolidityCheckedContract) {
          match = await tryToFindPerfectMetadataAndMatch(
            checkedContract,
            runtimeBytecode, // TODO: This is also weird we pass the runtime bytecode here
            match,
            async (match, recompiled) => {
              await matchWithCreationTx(
                match,
                recompiled.creationBytecode,
                sourcifyChain,
                address,
                creatorTxHash,
                recompiledMetadata,
                generateCreationCborAuxdataPositions,
                recompiled.creationLinkReferences,
              );
            },
            'creationMatch',
          );
        }
      }
    }
  } catch (e: any) {
    logWarn('Error matching with creation tx', {
      chain: sourcifyChain.chainId,
      address,
      creatorTxHash,
      error: e.message,
    });
  }

  // Case when extra unused files in compiler input cause different bytecode
  // See issues:
  // https://github.com/ethereum/sourcify/issues/618
  // https://github.com/ethereum/solidity/issues/14250
  // https://github.com/ethereum/solidity/issues/14494
  try {
    if (
      checkedContract instanceof SolidityCheckedContract &&
      splitAuxdata(
        match.onchainRuntimeBytecode || '',
        AuxdataStyle.SOLIDITY,
      )[1] ===
        splitAuxdata(
          checkedContract.runtimeBytecode || '',
          AuxdataStyle.SOLIDITY,
        )[1] &&
      match.runtimeMatch === null &&
      match.creationMatch === null &&
      checkedContract.metadata.settings.optimizer?.enabled
    ) {
      const [, deployedAuxdata] = splitAuxdata(
        runtimeBytecode,
        AuxdataStyle.SOLIDITY,
      );
      const [, recompiledAuxdata] = splitAuxdata(
        recompiled.runtimeBytecode,
        AuxdataStyle.SOLIDITY,
      );
      // Metadata hashes match but bytecodes don't match.
      if (deployedAuxdata === recompiledAuxdata) {
        (match as Match).runtimeMatch = 'extra-file-input-bug';
        (match as Match).message =
          "It seems your contract's metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618";
        return match;
      }
    }
  } catch (e: any) {
    logWarn('Error checking for extra-file-input-bug', {
      name: checkedContract.name,
      address,
      chainId: sourcifyChain.chainId,
      error: e.message,
    });
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
      logInfo('Force Emscripten compiler', {
        name: checkedContract.name,
        address,
        chainId: sourcifyChain.chainId,
      });
      return verifyDeployed(
        checkedContract,
        sourcifyChain,
        address,
        creatorTxHash,
        true, // Force compiling with Emscripten compiler
      );
    }
  } catch (e: any) {
    logWarn('Error handling "<0.8.21 and viaIR" bug', {
      name: checkedContract.name,
      address,
      chainId: sourcifyChain.chainId,
      error: e.message,
    });
  }

  if (match.creationMatch !== null || match.runtimeMatch !== null) {
    logInfo('Verified contract', {
      name: checkedContract.name,
      address,
      chainId: sourcifyChain.chainId,
      runtimeMatch: match.runtimeMatch,
      creationMatch: match.creationMatch,
    });
    return match;
  }

  logInfo('Failed to verify contract', {
    name: checkedContract.name,
    address,
    chainId: sourcifyChain.chainId,
  });
  throw Error("The deployed and recompiled bytecode don't match.");
}

async function tryToFindPerfectMetadataAndMatch(
  checkedContract: SolidityCheckedContract,
  runtimeBytecode: string,
  match: Match,
  matchFunction: (
    match: Match,
    recompilationResult: RecompilationResult,
  ) => Promise<void>,
  matchType: 'runtimeMatch' | 'creationMatch',
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
        checkedContractWithPerfectMetadata.sources,
      );
      return matchWithPerfectMetadata;
    }
  }
  return match;
}

export async function verifyCreate2(
  checkedContract: SolidityCheckedContract,
  deployerAddress: string,
  salt: string,
  create2Address: string,
  abiEncodedConstructorArguments?: string,
): Promise<Match> {
  const recompiled = await checkedContract.recompile();

  const computedAddr = calculateCreate2Address(
    deployerAddress,
    salt,
    recompiled.creationBytecode,
    abiEncodedConstructorArguments,
  );

  if (create2Address.toLowerCase() !== computedAddr.toLowerCase()) {
    throw new Error(
      `The provided create2 address doesn't match server's generated one. Expected: ${computedAddr} ; Received: ${create2Address} ;`,
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

export function normalizeBytecodesAuxdata(
  recompiledBytecode: string,
  onchainBytecode: string,
  cborAuxdataPositions: CompiledContractCborAuxdata,
) {
  try {
    let normalizedRecompiledBytecode = recompiledBytecode;
    let normalizedOnchainBytecode = onchainBytecode;
    const transformations: Transformation[] = [];
    const transformationsValuesCborAuxdata = {} as any;
    Object.values(cborAuxdataPositions).forEach((auxdataValues, index) => {
      const offsetStart = auxdataValues.offset * 2 + 2;
      const offsetEnd =
        auxdataValues.offset * 2 + 2 + auxdataValues.value.length - 2;
      normalizedRecompiledBytecode = replaceBytecodeAuxdatasWithZeros(
        normalizedRecompiledBytecode,
        offsetStart,
        offsetEnd,
      );
      const originalAuxdata = normalizedOnchainBytecode.slice(
        offsetStart,
        offsetEnd,
      );
      normalizedOnchainBytecode = replaceBytecodeAuxdatasWithZeros(
        normalizedOnchainBytecode,
        offsetStart,
        offsetEnd,
      );
      const transformationIndex = `${index + 1}`;
      transformations.push(
        AuxdataTransformation(auxdataValues.offset, transformationIndex),
      );
      transformationsValuesCborAuxdata[transformationIndex] =
        `0x${originalAuxdata}`;
    });
    return {
      normalizedRecompiledBytecode,
      normalizedOnchainBytecode,
      transformations,
      transformationsValuesCborAuxdata,
    };
  } catch (error: any) {
    logError('Cannot normalize bytecodes with the auxdata', {
      error,
    });
    throw new Error('Cannot normalize bytecodes with the auxdata');
  }
}

export async function matchWithRuntimeBytecode(
  match: Match,
  recompiledRuntimeBytecode: string,
  onchainRuntimeBytecode: string,
  generateCborAuxdataPositions: () => Promise<CompiledContractCborAuxdata>,
  immutableReferences: ImmutableReferences,
  linkReferences: LinkReferences,
  auxdataStyle: AuxdataStyle,
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
    match.runtimeTransformationValues,
  );

  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = handleLibraries(
    recompiledRuntimeBytecode,
    onchainRuntimeBytecode,
    linkReferences,
    match.runtimeTransformations,
    match.runtimeTransformationValues,
  );
  recompiledRuntimeBytecode = replaced;

  onchainRuntimeBytecode = replaceImmutableReferences(
    immutableReferences,
    onchainRuntimeBytecode,
    match.runtimeTransformations,
    match.runtimeTransformationValues,
    auxdataStyle,
  );

  // We call generateCborAuxdataPositions before returning because we always need
  // to fill cborAuxdata in creation_code_artifacts and runtime_code_artifacts
  const cborAuxdataPositions = await generateCborAuxdataPositions().catch(
    (error) => {
      logError('cannot generate contract artifacts', error);
      throw new Error('cannot generate contract artifacts');
    },
  );

  // If onchain bytecode is equal to recompiled bytecode
  if (recompiledRuntimeBytecode === onchainRuntimeBytecode) {
    match.libraryMap = libraryMap;
    match.immutableReferences = immutableReferences;
    // if the bytecode doesn't contain metadata then "partial" match
    if (endsWithMetadataHash(onchainRuntimeBytecode)) {
      match.runtimeMatch = 'perfect';
    } else {
      match.runtimeMatch = 'partial';
    }
    return;
  }

  // If onchain bytecode is not the same as recompiled bytecode try to match without the auxdatas

  // We use normalizeBytecodesAuxdata to replace all the auxdatas in both bytecodes with zeros
  const {
    normalizedRecompiledBytecode: normalizedRecompiledRuntimeBytecode,
    normalizedOnchainBytecode: normalizedOnchainRuntimeBytecode,
    transformations: runtimeAuxdataTransformations,
    transformationsValuesCborAuxdata: runtimeTransformationsValuesCborAuxdata,
  } = normalizeBytecodesAuxdata(
    recompiledRuntimeBytecode,
    onchainRuntimeBytecode,
    cborAuxdataPositions,
  )!;

  // If after the normalization the bytecodes are the same, we have a partial match
  if (normalizedRecompiledRuntimeBytecode == normalizedOnchainRuntimeBytecode) {
    match.libraryMap = libraryMap;
    match.immutableReferences = immutableReferences;
    match.runtimeMatch = 'partial';
    match.runtimeTransformations = [
      ...match.runtimeTransformations,
      ...runtimeAuxdataTransformations,
    ];
    match.runtimeTransformationValues.cborAuxdata =
      runtimeTransformationsValuesCborAuxdata;
    return;
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
  recompiledMetadata: Metadata,
  generateCborAuxdataPositions: () => Promise<CompiledContractCborAuxdata>,
  linkReferences: LinkReferences,
) {
  if (recompiledCreationBytecode === '0x') {
    match.creationMatch = null;
    match.message = `Failed to match with creation bytecode: recompiled contract's creation bytecode is empty`;
    return;
  }

  // Call rpc to find creatorTx, txReceipt and onchainContractCreationBytecode
  // return null creationMatch if fail
  let creatorTx;
  try {
    creatorTx = await sourcifyChain.getTx(creatorTxHash);
    match.creatorTxHash = creatorTxHash;
    match.blockNumber = creatorTx.blockNumber || undefined;
    match.deployer = creatorTx.from;

    const { creationBytecode, txReceipt } =
      await sourcifyChain.getContractCreationBytecodeAndReceipt(
        address,
        creatorTxHash,
        creatorTx,
      );
    match.onchainCreationBytecode = creationBytecode;
    match.txIndex = txReceipt.index;
  } catch (e: any) {
    logWarn('Failed to fetch creation bytecode', {
      address,
      txHash: creatorTxHash,
      chainId: sourcifyChain.chainId.toString(),
      error: e,
    });
    match.creationMatch = null;
    match.message = `Failed to match with creation bytecode: couldn't get the creation bytecode.`;
    return;
  }

  // Initialize the transformations array if undefined
  if (match.creationTransformations === undefined) {
    match.creationTransformations = [];
  }
  if (match.creationTransformationValues === undefined) {
    match.creationTransformationValues = {};
  }

  // Replace the library placeholders in the recompiled bytecode with values from the deployed bytecode
  const { replaced, libraryMap } = handleLibraries(
    recompiledCreationBytecode,
    match.onchainCreationBytecode,
    linkReferences,
    match.creationTransformations,
    match.creationTransformationValues,
  );
  recompiledCreationBytecode = replaced;

  // The reason why this uses `startsWith` instead of `===` is that creationTxData may contain constructor arguments at the end part.
  if (match.onchainCreationBytecode.startsWith(recompiledCreationBytecode)) {
    // if the bytecode doesn't end with metadata then "partial" match
    // endsWithMetadataHash checks the metadata hash, not only the CBOR auxdata
    if (endsWithMetadataHash(recompiledCreationBytecode)) {
      match.creationMatch = 'perfect';
    } else {
      // CBOR auxdata could be somewhere else in the bytecode
      const cborAuxdataPositions = await generateCborAuxdataPositions();
      const allCborAuxdataHaveMetadataHash = Object.values(
        cborAuxdataPositions,
      ).every(({ offset, value }) => {
        const cborAuxdataExtracted = recompiledCreationBytecode.slice(
          offset * 2,
          offset * 2 + value.length,
        );
        // REMEMBER! CBORAuxdata !== metadata hash. We need the metadata hash. endsWithMetadataHash checks the metadata hash
        return endsWithMetadataHash(cborAuxdataExtracted);
      });
      match.creationMatch = allCborAuxdataHaveMetadataHash
        ? 'perfect'
        : 'partial';
    }
    logDebug('Found creation match', {
      chainId: match.chainId,
      address,
      creationMatch: match.creationMatch,
    });
  } else {
    // If onchain bytecode is not the same as recompiled bytecode try to match without the auxdatas
    logDebug('Matching with trimmed creation bytecode', {
      chainId: match.chainId,
      address,
    });

    // We call generateCborAuxdataPositions only here because in the case of double auxdata it will
    // trigger a second compilation. We don't want to run the compiler twice if not strictly needed
    const cborAuxdataPositions = await generateCborAuxdataPositions();

    // We use normalizeBytecodesAuxdata to replace all the auxdatas in both bytecodes with zeros
    const {
      normalizedRecompiledBytecode: normalizedRecompiledCreationBytecode,
      normalizedOnchainBytecode: normalizedOnchainCreationBytecode,
      transformations: creationAuxdataTransformations,
      transformationsValuesCborAuxdata:
        creationTransformationsValuesCborAuxdata,
    } = normalizeBytecodesAuxdata(
      recompiledCreationBytecode,
      match.onchainCreationBytecode,
      cborAuxdataPositions,
    )!;

    // If after the normalization the bytecodes are the same, we have a partial match
    if (
      normalizedOnchainCreationBytecode.startsWith(
        normalizedRecompiledCreationBytecode,
      )
    ) {
      match.libraryMap = libraryMap;
      match.creationMatch = 'partial';
      match.creationTransformations = [
        ...match.creationTransformations,
        ...creationAuxdataTransformations,
      ];
      match.creationTransformationValues.cborAuxdata =
        creationTransformationsValuesCborAuxdata;
    }
  }

  if (match.creationMatch) {
    const abiEncodedConstructorArguments =
      extractAbiEncodedConstructorArguments(
        match.onchainCreationBytecode,
        recompiledCreationBytecode,
      );
    const constructorAbiParamInputs = (
      recompiledMetadata?.output?.abi?.find(
        (param) => param.type === 'constructor',
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
        abiEncodedConstructorArguments,
      );
      const encodeResult = abiCoder.encode(
        constructorAbiParamInputs,
        decodeResult,
      );
      if (encodeResult !== abiEncodedConstructorArguments) {
        match.creationMatch = null;
        match.message = `Failed to match with creation bytecode: constructor arguments ABI decoding failed ${encodeResult} vs ${abiEncodedConstructorArguments}`;
        return;
      }

      match.creationTransformations?.push(
        ConstructorTransformation(
          recompiledCreationBytecode.substring(2).length / 2,
        ),
      );
      match.creationTransformationValues.constructorArguments =
        abiEncodedConstructorArguments;
    }

    match.libraryMap = libraryMap;

    match.abiEncodedConstructorArguments = abiEncodedConstructorArguments;
  }
}

export function handleLibraries(
  template: string,
  real: string,
  linkReferences: LinkReferences,
  transformationsArray: Transformation[],
  transformationValues: TransformationValues,
): {
  replaced: string;
  libraryMap: StringMap;
} {
  const libraryMap: StringMap = {};
  for (const file in linkReferences) {
    for (const lib in linkReferences[file]) {
      for (const linkRefObj of linkReferences[file][lib]) {
        const fqn = `${file}:${lib}`; // Fully Qualified (FQ) name

        const { start, length } = linkRefObj;
        const strStart = start * 2 + 2; // Each byte 2 chars and +2 for 0x
        const strLength = length * 2;
        const placeholder = template.slice(strStart, strStart + strLength);

        // slice(2) removes 0x
        const calculatedPlaceholder =
          '__$' + keccak256Str(fqn).slice(2).slice(0, 34) + '$__';
        // Placeholder format was different pre v0.5.0 https://docs.soliditylang.org/en/v0.4.26/contracts.html#libraries
        const trimmedFQN = fqn.slice(0, 36); // in case the fqn is too long
        const calculatedPreV050Placeholder = '__' + trimmedFQN.padEnd(38, '_');

        if (
          !(
            placeholder === calculatedPlaceholder ||
            placeholder === calculatedPreV050Placeholder
          )
        )
          throw new Error(
            `Library placeholder mismatch: ${placeholder} vs ${calculatedPlaceholder} or ${calculatedPreV050Placeholder}`,
          );

        const address = real.slice(strStart, strStart + strLength);
        libraryMap[placeholder] = address;

        // Replace the specific occurrence of the placeholder
        template =
          template.slice(0, strStart) +
          address +
          template.slice(strStart + strLength);

        transformationsArray.push(LibraryTransformation(start, fqn));

        if (!transformationValues.libraries) {
          transformationValues.libraries = {};
        }
        // Prepend the library addresses with "0x", this is the format for the DB. FS library-map is without "0x"
        transformationValues.libraries[fqn] = '0x' + address;
      }
    }
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
  transformationValues: TransformationValues,
): string {
  const push20CodeOp = '73';
  const callProtection = `0x${push20CodeOp}${'00'.repeat(20)}`;

  if (template.startsWith(callProtection)) {
    const replacedCallProtection = real.slice(0, 0 + callProtection.length);
    const callProtectionAddress = replacedCallProtection.slice(4); // remove 0x73
    transformationsArray.push(CallProtectionTransformation());
    transformationValues.callProtection = '0x' + callProtectionAddress;

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
  transformationValues: TransformationValues,
  auxdataStyle: AuxdataStyle,
) {
  onchainRuntimeBytecode = onchainRuntimeBytecode.slice(2); // remove "0x"

  Object.keys(immutableReferences).forEach((astId) => {
    immutableReferences[astId].forEach((reference) => {
      const { start, length } = reference;

      // Save the transformation
      transformationsArray.push(
        ImmutablesTransformation(
          start,
          astId,
          auxdataStyle === AuxdataStyle.SOLIDITY ? 'replace' : 'insert',
        ),
      );
      const immutableValue = onchainRuntimeBytecode.slice(
        start * 2,
        start * 2 + length * 2,
      );

      // Save the transformation value
      if (transformationValues.immutables === undefined) {
        transformationValues.immutables = {};
      }
      transformationValues.immutables[astId] = `0x${immutableValue}`;

      if (auxdataStyle === AuxdataStyle.SOLIDITY) {
        // Write zeros in the place
        const zeros = '0'.repeat(length * 2);
        onchainRuntimeBytecode =
          onchainRuntimeBytecode.slice(0, start * 2) +
          zeros +
          onchainRuntimeBytecode.slice(start * 2 + length * 2);
      } else if (auxdataStyle === AuxdataStyle.VYPER) {
        // This case works only for Vyper 0.3.10 and above
        onchainRuntimeBytecode = onchainRuntimeBytecode.slice(0, start * 2);
      }
    });
  });
  return '0x' + onchainRuntimeBytecode;
}

function extractAbiEncodedConstructorArguments(
  onchainCreationBytecode: string,
  compiledCreationBytecode: string,
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
  abiEncodedConstructorArguments?: string,
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
      .join('')}`,
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
    const decodedCBOR = bytecodeDecode(bytecode, AuxdataStyle.SOLIDITY);
    endsWithMetadata =
      !!decodedCBOR.ipfs || !!decodedCBOR['bzzr0'] || !!decodedCBOR['bzzr1'];
  } catch (e) {
    logDebug("Can't decode CBOR, contract does not end with CBOR metadata");
    endsWithMetadata = false;
  }
  return endsWithMetadata;
}
