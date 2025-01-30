import { AbstractCompilation } from '../Compilation/AbstractCompilation';
import {
  ImmutableReferences,
  LinkReferences,
  Transformation,
  TransformationValues,
  StringMap,
  CompiledContractCborAuxdata,
} from '../lib/types';
import { logDebug, logInfo, logWarn } from '../lib/logger';
import SourcifyChain from '../lib/SourcifyChain';
import {
  handleLibraries,
  checkCallProtectionAndReplaceAddress,
  replaceImmutableReferences,
  normalizeBytecodesAuxdata,
} from '../lib/verification';
import { lt } from 'semver';
import { splitAuxdata, AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';

interface BytecodeMatchingContext {
  recompiledBytecode: string;
  onchainBytecode: string;
  linkReferences: LinkReferences;
  transformations: Transformation[];
  transformationValues: TransformationValues;
  cborAuxdata?: CompiledContractCborAuxdata;
  isCreation?: boolean;
}

interface BytecodeMatchingResult {
  match: 'perfect' | 'partial' | null;
  libraryMap?: StringMap;
  normalizedRecompiledBytecode?: string;
  transformations: Transformation[];
  transformationValues: TransformationValues;
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
    const runtimeBytecode = this.compilation.getRuntimeBytecode();
    const creationBytecode = this.compilation.getCreationBytecode();
    const immutableReferences = this.compilation.getImmutableReferences();
    const runtimeLinkReferences = this.compilation.getRuntimeLinkReferences();
    const creationLinkReferences = this.compilation.getCreationLinkReferences();

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

      await this.matchWithRuntimeBytecode(
        runtimeBytecode,
        this.onchainRuntimeBytecode,
        immutableReferences,
        runtimeLinkReferences,
      );

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
    if (this.creatorTxHash && creationBytecode) {
      try {
        logDebug('Matching with creation tx', {
          chain: this.sourcifyChain.chainId,
          address: this.address,
          creatorTxHash: this.creatorTxHash,
        });

        await this.matchWithCreationTx(
          creationBytecode,
          this.sourcifyChain,
          creationLinkReferences,
        );
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
    let { recompiledBytecode } = context;
    const { onchainBytecode } = context;
    const result: BytecodeMatchingResult = {
      match: null,
      transformations: [...context.transformations],
      transformationValues: { ...context.transformationValues },
    };

    // Replace library placeholders
    const { replaced, libraryMap } = handleLibraries(
      recompiledBytecode,
      onchainBytecode,
      context.linkReferences,
      result.transformations,
      result.transformationValues,
    );
    recompiledBytecode = replaced;

    // Direct bytecode match
    const matchesBytecode = context.isCreation
      ? onchainBytecode.startsWith(recompiledBytecode)
      : recompiledBytecode === onchainBytecode;

    if (matchesBytecode) {
      result.match = 'perfect';
      result.libraryMap = libraryMap;
      return result;
    }

    // Try matching with normalized auxdata
    if (!context.cborAuxdata) {
      return result;
    }

    const {
      normalizedRecompiledBytecode,
      normalizedOnchainBytecode,
      transformations: auxdataTransformations,
      transformationsValuesCborAuxdata,
    } = normalizeBytecodesAuxdata(
      recompiledBytecode,
      onchainBytecode,
      context.cborAuxdata,
    );

    result.normalizedRecompiledBytecode = normalizedRecompiledBytecode;

    const matchesNormalizedBytecode = context.isCreation
      ? normalizedOnchainBytecode.startsWith(normalizedRecompiledBytecode)
      : normalizedRecompiledBytecode === normalizedOnchainBytecode;

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

  private async matchWithRuntimeBytecode(
    recompiledRuntimeBytecode: string,
    onchainRuntimeBytecode: string,
    immutableReferences: ImmutableReferences,
    linkReferences: LinkReferences,
  ) {
    // Check if is a library with call protection
    recompiledRuntimeBytecode = checkCallProtectionAndReplaceAddress(
      recompiledRuntimeBytecode,
      onchainRuntimeBytecode,
      this.runtimeTransformations,
      this.runtimeTransformationValues,
    );

    // Handle immutable references
    onchainRuntimeBytecode = replaceImmutableReferences(
      immutableReferences,
      onchainRuntimeBytecode,
      this.runtimeTransformations,
      this.runtimeTransformationValues,
      this.compilation.auxdataStyle,
    );

    await this.compilation.generateCborAuxdataPositions();

    const result = await this.matchBytecodes({
      recompiledBytecode: recompiledRuntimeBytecode,
      onchainBytecode: onchainRuntimeBytecode,
      linkReferences,
      transformations: this.runtimeTransformations,
      transformationValues: this.runtimeTransformationValues,
      cborAuxdata: this.compilation.runtimeBytecodeCborAuxdata,
      isCreation: false,
    });

    this.runtimeMatch = result.match;
    this.libraryMap = result.libraryMap;
    this.normalizedRecompiledRuntimeBytecode =
      result.normalizedRecompiledBytecode;
    this.runtimeTransformations = result.transformations;
    this.runtimeTransformationValues = result.transformationValues;
  }

  private async matchWithCreationTx(
    recompiledCreationBytecode: string,
    sourcifyChain: SourcifyChain,
    linkReferences: LinkReferences,
  ) {
    if (!this.creatorTxHash) {
      return;
    }

    // Get creation transaction data
    const creatorTx = await sourcifyChain.getTx(this.creatorTxHash);
    this.blockNumber = creatorTx.blockNumber || undefined;
    this.deployer = creatorTx.from;

    const { creationBytecode, txReceipt } =
      await sourcifyChain.getContractCreationBytecodeAndReceipt(
        this.address,
        this.creatorTxHash,
        creatorTx,
      );
    this.onchainCreationBytecode = creationBytecode;
    this.txIndex = txReceipt.index;

    await this.compilation.generateCborAuxdataPositions();

    const result = await this.matchBytecodes({
      isCreation: true,
      recompiledBytecode: recompiledCreationBytecode,
      onchainBytecode: this.onchainCreationBytecode,
      linkReferences,
      transformations: this.creationTransformations,
      transformationValues: this.creationTransformationValues,
      cborAuxdata: this.compilation.creationBytecodeCborAuxdata,
    });

    this.creationMatch = result.match;
    this.libraryMap = result.libraryMap;
    this.normalizedRecompiledCreationBytecode =
      result.normalizedRecompiledBytecode;
    this.creationTransformations = result.transformations;
    this.creationTransformationValues = result.transformationValues;
  }

  // Getters for the verification results
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
}
