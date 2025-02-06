import { AbstractCompilation } from '../Compilation/AbstractCompilation';
import { logDebug, logInfo, logWarn } from '../logger';
import SourcifyChain from '../SourcifyChain';
import { lt } from 'semver';
import {
  splitAuxdata,
  AuxdataStyle,
  decode as decodeBytecode,
  SolidityDecodedObject,
} from '@ethereum-sourcify/bytecode-utils';
import { SolidityCompilation } from '../Compilation/SolidityCompilation';
import { StringMap } from '../Compilation/CompilationTypes';

import {
  checkAndCreateAuxdataTransformation,
  checkAndCreateCallProtectionTransformation,
  checkAndCreateConstructorArgumentsTransformation,
  checkAndCreateImmutablesTransformation,
  checkAndCreateLibrariesTransformation,
  Transformation,
  TransformationValues,
} from './Transformations';
import {
  BytecodeMatchingContext,
  BytecodeMatchingResult,
  SolidityBugType,
  VerificationError,
} from './VerificationTypes';

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
  private runtimeLibraryMap?: StringMap;
  private creationLibraryMap?: StringMap;
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

    try {
      this._onchainRuntimeBytecode = await this.sourcifyChain.getBytecode(
        this.address,
      );
    } catch (e: any) {
      throw new VerificationError(
        `RPC of chain #${this.sourcifyChain.chainId} is temporarily unavailable`,
        'CHAIN_UNAVAILABLE',
      );
    }

    if (this.onchainRuntimeBytecode === '0x') {
      throw new VerificationError(
        `Chain #${this.sourcifyChain.chainId} does not have a contract deployed at ${this.address}.`,
        'CONTRACT_NOT_DEPLOYED',
      );
    }

    // Compile the contract
    await this.compilation.compile(forceEmscripten);

    const compiledRuntimeBytecode = this.compilation.runtimeBytecode;
    const compiledCreationBytecode = this.compilation.creationBytecode;

    if (compiledRuntimeBytecode === '0x' || compiledCreationBytecode === '0x') {
      throw new VerificationError(
        `The compiled contract bytecode is "0x". Are you trying to verify an abstract contract?`,
        'COMPILED_BYTECODE_IS_ZERO',
      );
    }

    // We need to manually generate the auxdata positions because they are not automatically produced during compilation
    // Read more: https://docs.sourcify.dev/blog/finding-auxdatas-in-bytecode/
    await this.compilation.generateCborAuxdataPositions();

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
    }

    const solidityBugType = await this.handleSolidityBugCases(
      forceEmscripten,
      compiledRuntimeBytecode,
    );
    if (solidityBugType === SolidityBugType.ECMASCRIPT_BUG) {
      // TODO: change name of ECMASCRIPT_BUG
      return await this.verify({ forceEmscripten: true });
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

    throw new VerificationError(
      "The deployed and recompiled bytecode don't match.",
      'NO_MATCH',
    );
  }

  async handleSolidityBugCases(
    forceEmscripten: boolean,
    compiledRuntimeBytecode: string,
  ): Promise<SolidityBugType> {
    // Handle Solidity specific verification bug cases
    if (
      this.compilation instanceof SolidityCompilation &&
      this.runtimeMatch === null
    ) {
      const settings = this.compilation.jsonInput.settings;

      // Handle when <0.8.21 and with viaIR and with optimizer disabled
      // See issues:
      //   https://github.com/ethereum/sourcify/issues/1088
      if (
        !forceEmscripten && // Enter this case only if we are not already forcing Emscripten
        lt(this.compilation.compilerVersion, '0.8.21') &&
        !settings.optimizer?.enabled &&
        settings.viaIR
      ) {
        logInfo('Force Emscripten compiler', {
          address: this.address,
          chainId: this.sourcifyChain.chainId,
        });

        // Try to verify again with Emscripten
        return SolidityBugType.ECMASCRIPT_BUG;
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
          throw new VerificationError(
            "It seems your contract's metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618",
            'EXTRA_FILE_INPUT_BUG',
          );
        }
      } catch (e: any) {
        if (e instanceof VerificationError) {
          throw e;
        }
        logWarn('Error checking for extra-file-input-bug', {
          chain: this.sourcifyChain.chainId,
          address: this.address,
          error: e.message,
        });
        throw new VerificationError(
          e.message,
          'FAILED_TO_CHECK_EXTRA_FILE_INPUT_BUG',
        );
      }
    }
    return SolidityBugType.NONE;
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
    const librariesTransformationResult = checkAndCreateLibrariesTransformation(
      normalizedRecompiledBytecode,
      onchainBytecode,
      linkReferences,
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
            return true;
          }
        })
      ) {
        result.match = 'partial';
      } else {
        result.match = 'perfect';
      }

      result.libraryMap = libraryMap;
      result.transformations = [
        ...result.transformations,
        ...librariesTransformationResult.transformations,
      ];
      result.transformationValues = {
        ...result.transformationValues,
        ...librariesTransformationResult.transformationValues,
      };
      return result;
    }

    // If there is no perfect match and no auxdata, return null
    if (!cborAuxdata || Object.keys(cborAuxdata).length === 0) {
      return result;
    }

    const auxdataTransformationResult = checkAndCreateAuxdataTransformation(
      normalizedRecompiledBytecode,
      onchainBytecode,
      cborAuxdata,
    );

    result.normalizedRecompiledBytecode =
      auxdataTransformationResult.normalizedRecompiledBytecode;

    /* eslint-disable indent */
    const matchesNormalizedBytecode = context.isCreation
      ? onchainBytecode.startsWith(
          auxdataTransformationResult.normalizedRecompiledBytecode,
        )
      : auxdataTransformationResult.normalizedRecompiledBytecode ===
        onchainBytecode;
    /* eslint-enable indent */

    if (matchesNormalizedBytecode) {
      result.match = 'partial';
      result.libraryMap = libraryMap;
      result.transformations = [
        ...result.transformations,
        ...librariesTransformationResult.transformations,
        ...auxdataTransformationResult.transformations,
      ];
      result.transformationValues = {
        ...result.transformationValues,
        ...librariesTransformationResult.transformationValues,
        ...auxdataTransformationResult.transformationValues,
      };
    }

    return result;
  }

  private async matchWithRuntimeBytecode() {
    // Check if is a library with call protection
    const callProtectionTransformationResult =
      checkAndCreateCallProtectionTransformation(
        this.compilation.runtimeBytecode,
        this.onchainRuntimeBytecode,
      );

    // Handle immutable references
    const immutablesTransformationResult =
      checkAndCreateImmutablesTransformation(
        callProtectionTransformationResult.normalizedRecompiledBytecode,
        this.onchainRuntimeBytecode,
        this.compilation.immutableReferences,
        this.compilation.auxdataStyle,
      );

    const matchBytecodesResult = await this.matchBytecodes({
      isCreation: false,
      normalizedRecompiledBytecode:
        immutablesTransformationResult.normalizedRecompiledBytecode,
    });

    this.runtimeTransformations = [
      ...this.runtimeTransformations,
      ...callProtectionTransformationResult.transformations,
      ...immutablesTransformationResult.transformations,
      ...matchBytecodesResult.transformations,
    ];
    this.runtimeTransformationValues = {
      ...this.runtimeTransformationValues,
      ...callProtectionTransformationResult.transformationValues,
      ...immutablesTransformationResult.transformationValues,
      ...matchBytecodesResult.transformationValues,
    };

    this.runtimeMatch = matchBytecodesResult.match;
    this.runtimeLibraryMap = matchBytecodesResult.libraryMap;
  }

  private async matchWithCreationTx() {
    const matchBytecodesResult = await this.matchBytecodes({
      isCreation: true,
      normalizedRecompiledBytecode: this.compilation.creationBytecode,
    });

    this.creationMatch = matchBytecodesResult.match;
    this.creationLibraryMap = matchBytecodesResult.libraryMap;
    this.creationTransformations = matchBytecodesResult.transformations;
    this.creationTransformationValues =
      matchBytecodesResult.transformationValues;

    if (
      matchBytecodesResult.match === 'partial' ||
      matchBytecodesResult.match === 'perfect'
    ) {
      const constructorTransformationResult =
        checkAndCreateConstructorArgumentsTransformation(
          matchBytecodesResult.normalizedRecompiledBytecode,
          this.onchainCreationBytecode,
          this.compilation.metadata,
        );
      this.creationTransformations = [
        ...this.creationTransformations,
        ...constructorTransformationResult.transformations,
      ];
      this.creationTransformationValues = {
        ...this.creationTransformationValues,
        ...constructorTransformationResult.transformationValues,
      };
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
      throw new VerificationError(
        'Onchain runtime bytecode not available',
        'ONCHAIN_RUNTIME_BYTECODE_NOT_AVAILABLE',
      );
    }
    return this._onchainRuntimeBytecode;
  }

  get onchainCreationBytecode() {
    if (!this._onchainCreationBytecode) {
      throw new VerificationError(
        'Onchain creation bytecode not available',
        'ONCHAIN_CREATION_BYTECODE_NOT_AVAILABLE',
      );
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
    return {
      runtime: this.runtimeLibraryMap,
      creation: this.creationLibraryMap,
    };
  }

  get abiEncodedConstructorArguments() {
    return this._abiEncodedConstructorArguments;
  }
}
