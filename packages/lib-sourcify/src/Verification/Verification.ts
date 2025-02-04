import { AbstractCompilation } from '../Compilation/AbstractCompilation';
import { logDebug, logError, logInfo, logWarn } from '../logger';
import SourcifyChain from '../SourcifyChain';
import { lt } from 'semver';
import {
  splitAuxdata,
  AuxdataStyle,
  decode as decodeBytecode,
  SolidityDecodedObject,
} from '@ethereum-sourcify/bytecode-utils';
import { AbiConstructor } from 'abitype';
import { defaultAbiCoder as abiCoder, ParamType } from '@ethersproject/abi';
import { SolidityCompilation } from '../Compilation/SolidityCompilation';
import {
  CompiledContractCborAuxdata,
  LinkReferences,
  StringMap,
} from '../Compilation/CompilationTypes';
import { id as keccak256Str } from 'ethers';
import Transformations, {
  Transformation,
  TransformationValues,
} from './Transformations';

interface BytecodeMatchingContext {
  isCreation: boolean;
  normalizedRecompiledBytecode: string;
}

interface BytecodeMatchingResult {
  match: 'perfect' | 'partial' | null;
  libraryMap?: StringMap;
  normalizedRecompiledBytecode: string;
  transformations: Transformation[];
  transformationValues: TransformationValues;
  message?: string;
}

export class Verification {
  // Bytecodes
  private _onchainRuntimeBytecode?: string;
  private _onchainCreationBytecode?: string;

  // Transformations
  private runtimeTransformations: Transformation[] = [];
  private creationTransformations: Transformation[] = [];
  private runtimeTransformationValues: TransformationValues = {};
  private creationTransformationValues: TransformationValues = {};

  // Match status
  private runtimeMatch: 'perfect' | 'partial' | null = null;
  private creationMatch: 'perfect' | 'partial' | null = null;
  private _libraryMap?: StringMap;
  private blockNumber?: number;
  private txIndex?: number;
  private deployer?: string;
  private _abiEncodedConstructorArguments?: string;

  constructor(
    private compilation: AbstractCompilation,
    private sourcifyChain: SourcifyChain,
    private address: string,
    private creatorTxHash?: string,
  ) {}

  async verify({
    forceEmscripten = false,
  }: { forceEmscripten?: boolean } = {}): Promise<void> {
    logInfo('Verifying contract', {
      address: this.address,
      chainId: this.sourcifyChain.chainId,
    });

    this._onchainRuntimeBytecode = await this.sourcifyChain.getBytecode(
      this.address,
    );

    // Can't match if there is no deployed bytecode
    if (!this.onchainRuntimeBytecode) {
      // todo: add custom SourcifyLibError, with custom code/message
      throw new Error(
        `Chain #${this.sourcifyChain.chainId} is temporarily unavailable`,
      );
    }
    if (this.onchainRuntimeBytecode === '0x') {
      throw new Error(
        `Chain #${this.sourcifyChain.chainId} does not have a contract deployed at ${this.address}.`,
      );
    }

    // Compile the contract
    await this.compilation.compile();

    // We need to manually generate the auxdata positions because they are not automatically produced during compilation
    // Read more: https://docs.sourcify.dev/blog/finding-auxdatas-in-bytecode/
    await this.compilation.generateCborAuxdataPositions();

    const compiledRuntimeBytecode = this.compilation.runtimeBytecode;
    const compiledCreationBytecode = this.compilation.creationBytecode;

    if (compiledRuntimeBytecode === '0x' || compiledCreationBytecode === '0x') {
      throw new Error(
        `The compiled contract bytecode is "0x". Are you trying to verify an abstract contract?`,
      );
    }

    // Try to match onchain runtime bytecode with compiled runtime bytecode
    try {
      logDebug('Matching with deployed bytecode', {
        chain: this.sourcifyChain.chainId,
        address: this.address,
      });
      await this.matchWithRuntimeBytecode();
    } catch (e: any) {
      logWarn('Error matching with runtime bytecode', {
        chain: this.sourcifyChain.chainId,
        address: this.address,
        error: e.message,
      });
      throw e;
    }

    // Handle Solidity specific verification bug cases
    if (
      this.compilation instanceof SolidityCompilation &&
      this.runtimeMatch === null &&
      this.creationMatch === null
    ) {
      const settings = this.compilation.jsonInput.settings;

      // Handle when <0.8.21 and with viaIR and with optimizer disabled
      // See issues:
      //   https://github.com/ethereum/sourcify/issues/1088
      if (
        !forceEmscripten && // Enter this case only if we are not already forcing Emscripten
        lt(this.compilation.compilerVersion, '0.8.21') &&
        !settings.optimizer?.enabled &&
        settings?.viaIR
      ) {
        logInfo('Force Emscripten compiler', {
          address: this.address,
          chainId: this.sourcifyChain.chainId,
        });

        // Try to verify again with Emscripten
        return this.verify({ forceEmscripten: true });
      }

      // Case when extra unused files in compiler input cause different bytecode
      // See issues:
      //   https://github.com/ethereum/sourcify/issues/618
      //   https://github.com/ethereum/solidity/issues/14250
      //   https://github.com/ethereum/solidity/issues/14494
      try {
        const [, deployedAuxdata] = splitAuxdata(
          this.onchainRuntimeBytecode,
          AuxdataStyle.SOLIDITY,
        );
        const [, recompiledAuxdata] = splitAuxdata(
          compiledRuntimeBytecode,
          AuxdataStyle.SOLIDITY,
        );
        // Metadata hashes match but bytecodes don't match.
        if (
          deployedAuxdata === recompiledAuxdata &&
          settings.optimizer?.enabled
        ) {
          throw new Error(
            "It seems your contract's metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618",
          );
        }
      } catch (e: any) {
        logWarn('Error checking for extra-file-input-bug', {
          chain: this.sourcifyChain.chainId,
          address: this.address,
          error: e.message,
        });
        throw e;
      }
    }

    // Try to match onchain creation bytecode with compiled creation bytecode
    if (this.creatorTxHash) {
      try {
        logDebug('Matching with creation tx', {
          chain: this.sourcifyChain.chainId,
          address: this.address,
          creatorTxHash: this.creatorTxHash,
        });

        // Get creation transaction data
        const creatorTx = await this.sourcifyChain.getTx(this.creatorTxHash);
        this.blockNumber = creatorTx.blockNumber || undefined;
        this.deployer = creatorTx.from;

        const { creationBytecode, txReceipt } =
          await this.sourcifyChain.getContractCreationBytecodeAndReceipt(
            this.address,
            this.creatorTxHash,
            creatorTx,
          );
        this._onchainCreationBytecode = creationBytecode;
        this.txIndex = txReceipt.index;

        await this.matchWithCreationTx();
      } catch (e: any) {
        logWarn('Error matching with creation tx', {
          chain: this.sourcifyChain.chainId,
          address: this.address,
          creatorTxHash: this.creatorTxHash,
          error: e.message,
        });
        throw e;
      }
    }

    if (this.creationMatch !== null || this.runtimeMatch !== null) {
      logInfo('Verified contract', {
        address: this.address,
        chainId: this.sourcifyChain.chainId,
        runtimeMatch: this.runtimeMatch,
        creationMatch: this.creationMatch,
      });
      return;
    }

    throw Error("The deployed and recompiled bytecode don't match.");
  }

  private async matchBytecodes(
    context: BytecodeMatchingContext,
  ): Promise<BytecodeMatchingResult> {
    // Here we use bytecodes from the context because they are already processed
    let normalizedRecompiledBytecode = context.normalizedRecompiledBytecode;
    const onchainBytecode = context.isCreation
      ? this.onchainCreationBytecode
      : this.onchainRuntimeBytecode;

    const cborAuxdata = context.isCreation
      ? this.compilation.creationBytecodeCborAuxdata
      : this.compilation.runtimeBytecodeCborAuxdata;

    const transformations = context.isCreation
      ? this.creationTransformations
      : this.runtimeTransformations;
    const transformationValues = context.isCreation
      ? this.creationTransformationValues
      : this.runtimeTransformationValues;

    const linkReferences = context.isCreation
      ? this.compilation.creationLinkReferences
      : this.compilation.runtimeLinkReferences;

    const result: BytecodeMatchingResult = {
      match: null,
      transformations: [...transformations],
      transformationValues: { ...transformationValues },
      normalizedRecompiledBytecode,
    };

    // Replace library placeholders
    const librariesTransformationResult =
      this.checkAndCreateLibrariesTransformation(
        normalizedRecompiledBytecode,
        onchainBytecode,
        linkReferences,
        transformations,
        transformationValues,
      );
    const libraryMap = librariesTransformationResult.libraryMap;
    normalizedRecompiledBytecode =
      librariesTransformationResult.normalizedRecompiledBytecode;

    // Direct bytecode match
    const matchesBytecode = context.isCreation
      ? onchainBytecode.startsWith(normalizedRecompiledBytecode)
      : normalizedRecompiledBytecode === onchainBytecode;

    if (matchesBytecode) {
      // If there is perfect match but auxdata doesn't contain any metadata hash, return partial match
      if (
        !cborAuxdata ||
        Object.keys(cborAuxdata).length === 0 ||
        Object.values(cborAuxdata).some((cborAuxdata) => {
          try {
            const { ipfs, bzzr0, bzzr1 } = decodeBytecode(
              cborAuxdata.value,
              this.compilation.auxdataStyle,
            ) as SolidityDecodedObject;
            return (
              ipfs === undefined && bzzr0 === undefined && bzzr1 === undefined
            );
          } catch {
            return false;
          }
        })
      ) {
        result.match = 'partial';
        result.libraryMap = libraryMap;
        return result;
      }

      result.match = 'perfect';
      result.libraryMap = libraryMap;
      return result;
    }

    // If there is no perfect match and no auxdata, return null
    if (!cborAuxdata || Object.keys(cborAuxdata).length === 0) {
      return result;
    }

    const {
      normalizedRecompiledBytecode: normalizedRecompiledBytecode_,
      transformations: auxdataTransformations,
      transformationsValuesCborAuxdata,
    } = this.checkAndCreateAuxdataTransformation(
      normalizedRecompiledBytecode,
      onchainBytecode,
      cborAuxdata,
    );

    result.normalizedRecompiledBytecode = normalizedRecompiledBytecode_;

    const matchesNormalizedBytecode = context.isCreation
      ? onchainBytecode.startsWith(normalizedRecompiledBytecode_)
      : normalizedRecompiledBytecode_ === onchainBytecode;

    if (matchesNormalizedBytecode) {
      result.match = 'partial';
      result.libraryMap = libraryMap;
      result.transformations = [
        ...result.transformations,
        ...auxdataTransformations,
      ];
      result.transformationValues.cborAuxdata =
        transformationsValuesCborAuxdata;
    }

    return result;
  }

  private async matchWithRuntimeBytecode() {
    // Check if is a library with call protection
    let normalizedRecompiledRuntimeBytecode =
      this.checkAndCreateCallProtectionTransformation(
        this.compilation.runtimeBytecode,
      );

    // Handle immutable references
    normalizedRecompiledRuntimeBytecode =
      this.checkAndCreateImmutablesTransformation(
        normalizedRecompiledRuntimeBytecode,
      );

    const result = await this.matchBytecodes({
      isCreation: false,
      normalizedRecompiledBytecode: normalizedRecompiledRuntimeBytecode,
    });

    this.runtimeMatch = result.match;
    this._libraryMap = result.libraryMap;
    this.runtimeTransformations = result.transformations;
    this.runtimeTransformationValues = result.transformationValues;
  }

  private async matchWithCreationTx() {
    const result = await this.matchBytecodes({
      isCreation: true,
      normalizedRecompiledBytecode: this.compilation.creationBytecode,
    });

    this.creationMatch = result.match;
    this._libraryMap = result.libraryMap;
    this.creationTransformations = result.transformations;
    this.creationTransformationValues = result.transformationValues;

    if (result.match === 'partial' || result.match === 'perfect') {
      this.checkAndCreateConstructorArgumentsTransformation(
        result.normalizedRecompiledBytecode,
      );
    }
  }

  get status() {
    return {
      runtimeMatch: this.runtimeMatch,
      creationMatch: this.creationMatch,
    };
  }

  get onchainRuntimeBytecode() {
    if (!this._onchainRuntimeBytecode) {
      throw new Error('Onchain runtime bytecode not available');
    }
    return this._onchainRuntimeBytecode;
  }

  get onchainCreationBytecode() {
    if (!this._onchainCreationBytecode) {
      throw new Error('Onchain creation bytecode not available');
    }
    return this._onchainCreationBytecode;
  }

  get transformations() {
    return {
      runtime: {
        list: this.runtimeTransformations,
        values: this.runtimeTransformationValues,
      },
      creation: {
        list: this.creationTransformations,
        values: this.creationTransformationValues,
      },
    };
  }

  get deploymentInfo() {
    return {
      blockNumber: this.blockNumber,
      txIndex: this.txIndex,
      deployer: this.deployer,
    };
  }

  get libraryMap() {
    return this._libraryMap;
  }

  get abiEncodedConstructorArguments() {
    return this._abiEncodedConstructorArguments;
  }

  // transformation functions

  // returns the full bytecode with the call protection replaced with the real address
  checkAndCreateCallProtectionTransformation(
    normalizedRecompiledBytecode: string,
  ): string {
    const template = normalizedRecompiledBytecode;
    const real = this.onchainRuntimeBytecode;
    const transformationsArray = this.runtimeTransformations;
    const transformationValues = this.runtimeTransformationValues;

    const push20CodeOp = '73';
    const callProtection = `0x${push20CodeOp}${'00'.repeat(20)}`;

    if (template.startsWith(callProtection)) {
      const replacedCallProtection = real.slice(0, 0 + callProtection.length);
      const callProtectionAddress = replacedCallProtection.slice(4); // remove 0x73
      transformationsArray.push(Transformations.CallProtectionTransformation());
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
  checkAndCreateImmutablesTransformation(normalizedRecompiledBytecode: string) {
    const immutableReferences = this.compilation.immutableReferences;
    const transformationsArray = this.runtimeTransformations;
    const transformationValues = this.runtimeTransformationValues;
    const auxdataStyle = this.compilation.auxdataStyle;
    // Remove "0x" from the beginning of both bytecodes.
    const onchainRuntimeBytecode = this.onchainRuntimeBytecode.slice(2);
    normalizedRecompiledBytecode = normalizedRecompiledBytecode.slice(2);

    Object.keys(immutableReferences).forEach((astId) => {
      immutableReferences[astId].forEach((reference) => {
        const { start, length } = reference;

        // Save the transformation
        transformationsArray.push(
          Transformations.ImmutablesTransformation(
            start,
            astId,
            auxdataStyle === AuxdataStyle.SOLIDITY ? 'replace' : 'insert',
          ),
        );

        // Extract the immutable value from the onchain bytecode.
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
          // Replace the placeholder in the recompiled bytecode with the onchain immutable value.
          normalizedRecompiledBytecode =
            normalizedRecompiledBytecode.slice(0, start * 2) +
            immutableValue +
            normalizedRecompiledBytecode.slice(start * 2 + length * 2);
        } else if (auxdataStyle === AuxdataStyle.VYPER) {
          // For Vyper, insert the immutable value.
          normalizedRecompiledBytecode =
            normalizedRecompiledBytecode + immutableValue;
        }
      });
    });
    return '0x' + normalizedRecompiledBytecode;
  }

  extractAbiEncodedConstructorArguments(normalizedRecompiledBytecode: string) {
    if (
      this.onchainCreationBytecode.length ===
      normalizedRecompiledBytecode.length
    )
      return undefined;

    return (
      '0x' +
      this.onchainCreationBytecode.slice(normalizedRecompiledBytecode.length)
    );
  }

  checkAndCreateConstructorArgumentsTransformation(
    normalizedRecompiledBytecode: string,
  ) {
    const abiEncodedConstructorArguments =
      this.extractAbiEncodedConstructorArguments(normalizedRecompiledBytecode);
    const constructorAbiParamInputs = (
      this.compilation.metadata?.output?.abi?.find(
        (param) => param.type === 'constructor',
      ) as AbiConstructor
    )?.inputs as ParamType[];
    if (abiEncodedConstructorArguments) {
      if (!constructorAbiParamInputs) {
        throw new Error(
          `Failed to match with creation bytecode: constructor ABI Inputs are missing`,
        );
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
        throw new Error(
          `Failed to match with creation bytecode: constructor arguments ABI decoding failed ${encodeResult} vs ${abiEncodedConstructorArguments}`,
        );
      }

      this.creationTransformations.push(
        Transformations.ConstructorTransformation(
          normalizedRecompiledBytecode.substring(2).length / 2,
        ),
      );
      this.creationTransformationValues.constructorArguments =
        abiEncodedConstructorArguments;
    }
    this._abiEncodedConstructorArguments = abiEncodedConstructorArguments;
  }

  checkAndCreateLibrariesTransformation(
    template: string,
    real: string,
    linkReferences: LinkReferences,
    transformationsArray: Transformation[],
    transformationValues: TransformationValues,
  ): {
    normalizedRecompiledBytecode: string;
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
          const calculatedPreV050Placeholder =
            '__' + trimmedFQN.padEnd(38, '_');

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

          transformationsArray.push(
            Transformations.LibraryTransformation(start, fqn),
          );

          if (!transformationValues.libraries) {
            transformationValues.libraries = {};
          }
          // Prepend the library addresses with "0x", this is the format for the DB. FS library-map is without "0x"
          transformationValues.libraries[fqn] = '0x' + address;
        }
      }
    }

    return {
      normalizedRecompiledBytecode: template,
      libraryMap,
    };
  }

  checkAndCreateAuxdataTransformation(
    recompiledBytecode: string,
    onchainBytecode: string,
    cborAuxdataPositions: CompiledContractCborAuxdata,
  ) {
    try {
      let normalizedRecompiledBytecode = recompiledBytecode;
      const transformations: Transformation[] = [];
      const transformationsValuesCborAuxdata = {} as any;
      // Instead of normalizing the onchain bytecode, we use its auxdata values to replace the corresponding sections in the recompiled bytecode.
      Object.values(cborAuxdataPositions).forEach((auxdataValues, index) => {
        const offsetStart = auxdataValues.offset * 2 + 2;
        const offsetEnd =
          auxdataValues.offset * 2 + 2 + auxdataValues.value.length - 2;
        // Instead of zeroing out this segment, get the value from the onchain bytecode.
        const onchainAuxdata = onchainBytecode.slice(offsetStart, offsetEnd);
        normalizedRecompiledBytecode =
          normalizedRecompiledBytecode.slice(0, offsetStart) +
          onchainAuxdata +
          normalizedRecompiledBytecode.slice(offsetEnd);
        const transformationIndex = `${index + 1}`;
        transformations.push(
          Transformations.AuxdataTransformation(
            auxdataValues.offset,
            transformationIndex,
          ),
        );
        transformationsValuesCborAuxdata[transformationIndex] =
          `0x${onchainAuxdata}`;
      });
      return {
        normalizedRecompiledBytecode,
        transformations,
        transformationsValuesCborAuxdata,
      };
    } catch (error: any) {
      logError('Cannot normalize bytecodes with the auxdata', { error });
      throw new Error('Cannot normalize bytecodes with the auxdata');
    }
  }
}
