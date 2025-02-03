import { AbstractCompilation } from '../Compilation/AbstractCompilation';
import {
  Transformation,
  TransformationValues,
  StringMap,
  ConstructorTransformation,
} from '../lib/types';
import { logDebug, logInfo, logWarn } from '../lib/logger';
import SourcifyChain from '../lib/SourcifyChain';
import {
  handleLibraries,
  checkCallProtectionAndReplaceAddress,
  replaceImmutableReferences,
  normalizeBytecodesAuxdata,
  extractAbiEncodedConstructorArguments,
} from '../lib/verification';
import { lt } from 'semver';
import {
  splitAuxdata,
  AuxdataStyle,
  decode as decodeBytecode,
  SolidityDecodedObject,
} from '@ethereum-sourcify/bytecode-utils';
import { AbiConstructor } from 'abitype';
import { defaultAbiCoder as abiCoder, ParamType } from '@ethersproject/abi';

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
  private normalizedRecompiledRuntimeBytecode?: string;
  private normalizedRecompiledCreationBytecode?: string;
  private onchainRuntimeBytecode?: string;
  private onchainCreationBytecode?: string;

  // Transformations
  private runtimeTransformations: Transformation[] = [];
  private creationTransformations: Transformation[] = [];
  private runtimeTransformationValues: TransformationValues = {};
  private creationTransformationValues: TransformationValues = {};

  // Match status
  private runtimeMatch: 'perfect' | 'partial' | null = null;
  private creationMatch: 'perfect' | 'partial' | null = null;
  private libraryMap?: StringMap;
  private blockNumber?: number;
  private txIndex?: number;
  private deployer?: string;
  private abiEncodedConstructorArguments?: string;

  constructor(
    private compilation: AbstractCompilation,
    private sourcifyChain: SourcifyChain,
    private address: string,
    private creatorTxHash?: string,
  ) {}

  async verify(): Promise<void> {
    logInfo('Verifying contract', {
      address: this.address,
      chainId: this.sourcifyChain.chainId,
    });

    this.onchainRuntimeBytecode = await this.sourcifyChain.getBytecode(
      this.address,
    );

    // Can't match if there is no deployed bytecode
    if (!this.onchainRuntimeBytecode) {
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
    await this.compilation.generateCborAuxdataPositions();
    const runtimeBytecode = this.compilation.getRuntimeBytecode();
    const creationBytecode = this.compilation.getCreationBytecode();

    if (runtimeBytecode === '0x' || creationBytecode === '0x') {
      throw new Error(
        `The compiled contract bytecode is "0x". Are you trying to verify an abstract contract?`,
      );
    }

    // Try to match with deployed bytecode
    try {
      logDebug('Matching with deployed bytecode', {
        chain: this.sourcifyChain.chainId,
        address: this.address,
      });

      await this.matchWithRuntimeBytecode();

      // Handle viaIR + disabled optimizer + <0.8.21 case
      if (this.runtimeMatch === null && this.creationMatch === null) {
        const metadata = this.compilation.getMetadata();
        if (
          lt(metadata.compiler.version, '0.8.21') &&
          !metadata.settings.optimizer?.enabled &&
          metadata.settings?.viaIR
        ) {
          logInfo('Force Emscripten compiler', {
            address: this.address,
            chainId: this.sourcifyChain.chainId,
          });

          // Recompile with Emscripten and retry verification
          await this.compilation.compile(true);
          return this.verify();
        }
      }
    } catch (e: any) {
      logWarn('Error matching with runtime bytecode', {
        chain: this.sourcifyChain.chainId,
        address: this.address,
        error: e.message,
      });
      throw e;
    }

    // Case when extra unused files in compiler input cause different bytecode
    // See issues:
    // https://github.com/ethereum/sourcify/issues/618
    // https://github.com/ethereum/solidity/issues/14250
    // https://github.com/ethereum/solidity/issues/14494
    try {
      if (this.runtimeMatch === null && this.creationMatch === null) {
        const metadata = this.compilation.getMetadata();
        const [, deployedAuxdata] = splitAuxdata(
          this.onchainRuntimeBytecode || '',
          AuxdataStyle.SOLIDITY,
        );
        const [, recompiledAuxdata] = splitAuxdata(
          runtimeBytecode,
          AuxdataStyle.SOLIDITY,
        );
        // Metadata hashes match but bytecodes don't match.
        if (
          deployedAuxdata === recompiledAuxdata &&
          metadata.settings.optimizer?.enabled
        ) {
          throw new Error(
            "It seems your contract's metadata hashes match but not the bytecodes. You should add all the files input to the compiler during compilation and remove all others. See the issue for more information: https://github.com/ethereum/sourcify/issues/618",
          );
        }
      }
    } catch (e: any) {
      logWarn('Error checking for extra-file-input-bug', {
        chain: this.sourcifyChain.chainId,
        address: this.address,
        error: e.message,
      });
      throw e;
    }

    // Try to match with creation tx if available
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
        this.onchainCreationBytecode = creationBytecode;
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
      ? this.getOnchainCreationBytecode()
      : this.getOnchainRuntimeBytecode();

    const cborAuxdata = context.isCreation
      ? this.compilation.getCreationBytecodeCborAuxdata()
      : this.compilation.getRuntimeBytecodeCborAuxdata();

    const transformations = context.isCreation
      ? this.creationTransformations
      : this.runtimeTransformations;
    const transformationValues = context.isCreation
      ? this.creationTransformationValues
      : this.runtimeTransformationValues;

    const linkReferences = context.isCreation
      ? this.compilation.getCreationLinkReferences()
      : this.compilation.getRuntimeLinkReferences();

    const result: BytecodeMatchingResult = {
      match: null,
      transformations: [...transformations],
      transformationValues: { ...transformationValues },
      normalizedRecompiledBytecode,
    };

    // Replace library placeholders
    const { replaced, libraryMap } = handleLibraries(
      normalizedRecompiledBytecode,
      onchainBytecode,
      linkReferences,
      result.transformations,
      result.transformationValues,
    );
    normalizedRecompiledBytecode = replaced;

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
    } = normalizeBytecodesAuxdata(
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
      checkCallProtectionAndReplaceAddress(
        this.compilation.getRuntimeBytecode(),
        this.getOnchainRuntimeBytecode(),
        this.runtimeTransformations,
        this.runtimeTransformationValues,
      );

    // Handle immutable references
    normalizedRecompiledRuntimeBytecode = replaceImmutableReferences(
      this.compilation.getImmutableReferences(),
      this.getOnchainRuntimeBytecode(),
      normalizedRecompiledRuntimeBytecode,
      this.runtimeTransformations,
      this.runtimeTransformationValues,
      this.compilation.auxdataStyle,
    );

    const result = await this.matchBytecodes({
      isCreation: false,
      normalizedRecompiledBytecode: normalizedRecompiledRuntimeBytecode,
    });

    this.runtimeMatch = result.match;
    this.libraryMap = result.libraryMap;
    this.normalizedRecompiledRuntimeBytecode =
      result.normalizedRecompiledBytecode;
    this.runtimeTransformations = result.transformations;
    this.runtimeTransformationValues = result.transformationValues;
  }

  private async matchWithCreationTx() {
    const result = await this.matchBytecodes({
      isCreation: true,
      normalizedRecompiledBytecode: this.compilation.getCreationBytecode(),
    });

    if (result.match === 'partial' || result.match === 'perfect') {
      const abiEncodedConstructorArguments =
        extractAbiEncodedConstructorArguments(
          this.getOnchainCreationBytecode(),
          result.normalizedRecompiledBytecode,
        );
      const constructorAbiParamInputs = (
        this.compilation
          .getMetadata()
          ?.output?.abi?.find(
            (param) => param.type === 'constructor',
          ) as AbiConstructor
      )?.inputs as ParamType[];
      if (abiEncodedConstructorArguments) {
        if (!constructorAbiParamInputs) {
          result.match = null;
          result.message = `Failed to match with creation bytecode: constructor ABI Inputs are missing`;
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
          result.match = null;
          result.message = `Failed to match with creation bytecode: constructor arguments ABI decoding failed ${encodeResult} vs ${abiEncodedConstructorArguments}`;
          return;
        }

        result.transformations?.push(
          ConstructorTransformation(
            result.normalizedRecompiledBytecode.substring(2).length / 2,
          ),
        );
        result.transformationValues.constructorArguments =
          abiEncodedConstructorArguments;
      }
      this.abiEncodedConstructorArguments = abiEncodedConstructorArguments;
    }

    this.creationMatch = result.match;
    this.libraryMap = result.libraryMap;
    this.normalizedRecompiledCreationBytecode =
      result.normalizedRecompiledBytecode;
    this.creationTransformations = result.transformations;
    this.creationTransformationValues = result.transformationValues;
  }

  public getStatus() {
    return {
      runtimeMatch: this.runtimeMatch,
      creationMatch: this.creationMatch,
    };
  }

  public getTransformations() {
    return {
      runtimeTransformations: this.runtimeTransformations,
      creationTransformations: this.creationTransformations,
      runtimeTransformationValues: this.runtimeTransformationValues,
      creationTransformationValues: this.creationTransformationValues,
    };
  }

  public getBytecodes() {
    return {
      onchainRuntimeBytecode: this.onchainRuntimeBytecode,
      onchainCreationBytecode: this.onchainCreationBytecode,
      normalizedRecompiledRuntimeBytecode:
        this.normalizedRecompiledRuntimeBytecode,
      normalizedRecompiledCreationBytecode:
        this.normalizedRecompiledCreationBytecode,
    };
  }

  public getDeploymentInfo() {
    return {
      blockNumber: this.blockNumber,
      txIndex: this.txIndex,
      deployer: this.deployer,
    };
  }

  public getLibraryMap() {
    return this.libraryMap;
  }

  public getOnchainCreationBytecode(): string {
    if (!this.onchainCreationBytecode) {
      throw new Error('Onchain creation bytecode not available');
    }
    return this.onchainCreationBytecode;
  }

  public getOnchainRuntimeBytecode(): string {
    if (!this.onchainRuntimeBytecode) {
      throw new Error('Onchain runtime bytecode not available');
    }
    return this.onchainRuntimeBytecode;
  }

  public getAbiEncodedConstructorArguments() {
    return this.abiEncodedConstructorArguments;
  }
}
