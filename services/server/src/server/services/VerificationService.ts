import {
  verifyDeployed as libSourcifyVerifyDeployed,
  AbstractCheckedContract,
  Match,
  SourcifyChain,
  ISolidityCompiler,
  SolidityJsonInput,
  VyperJsonInput,
  PathBuffer,
  Verification,
  SolidityCompilation,
  VyperCompilation,
  CompilationTarget,
} from "@ethereum-sourcify/lib-sourcify";
import { getCreatorTx } from "./utils/contract-creation-util";
import { ContractIsAlreadyBeingVerifiedError } from "../../common/errors/ContractIsAlreadyBeingVerifiedError";
import logger from "../../common/logger";
import {
  findSolcPlatform,
  getSolcExecutable,
  getSolcJs,
} from "@ethereum-sourcify/compilers";

export interface VerificationServiceOptions {
  initCompilers?: boolean;
  solcRepoPath: string;
  solJsonRepoPath: string;
}

export class VerificationService {
  initCompilers: boolean;
  solcRepoPath: string;
  solJsonRepoPath: string;
  activeVerificationsByChainIdAddress: {
    [chainIdAndAddress: string]: boolean;
  } = {};

  constructor(options: VerificationServiceOptions) {
    this.initCompilers = options.initCompilers || false;
    this.solcRepoPath = options.solcRepoPath;
    this.solJsonRepoPath = options.solJsonRepoPath;
  }

  // All of the solidity compilation actually run outside the VerificationService but this is an OK place to init everything.
  public async init() {
    const HOST_SOLC_REPO = "https://binaries.soliditylang.org/";

    if (this.initCompilers) {
      const platform = findSolcPlatform() || "bin"; // fallback to emscripten binaries "bin"
      logger.info(`Initializing compilers for platform ${platform}`);

      // solc binary and solc-js downloads are handled with different helpers
      const downLoadFunc =
        platform === "bin"
          ? (version: string) => getSolcJs(this.solJsonRepoPath, version)
          : // eslint-disable-next-line indent
            (version: string) =>
              getSolcExecutable(this.solcRepoPath, platform, version);

      // get the list of compiler versions
      let solcList: string[];
      try {
        solcList = await fetch(`${HOST_SOLC_REPO}${platform}/list.json`)
          .then((response) => response.json())
          .then((data) =>
            (Object.values(data.releases) as string[])
              .map((str) => str.split("-v")[1]) // e.g. soljson-v0.8.26+commit.8a97fa7a.js or solc-linux-amd64-v0.8.26+commit.8a97fa7a
              .map(
                (str) => (str.endsWith(".js") ? str.slice(0, -3) : str), // remove .js extension
              ),
          );
      } catch (e) {
        throw new Error(`Failed to fetch list of solc versions: ${e}`);
      }

      const chunkSize = 10; // Download in chunks to not overload the Solidity server all at once
      for (let i = 0; i < solcList.length; i += chunkSize) {
        const chunk = solcList.slice(i, i + chunkSize);
        const promises = chunk.map((solcVer) => {
          const now = Date.now();
          return downLoadFunc(solcVer).then(() => {
            logger.debug(
              `Downloaded (or found existing) compiler ${solcVer} in ${Date.now() - now}ms`,
            );
          });
        });

        await Promise.all(promises);
        logger.debug(
          `Batch ${i / chunkSize + 1} - Downloaded ${promises.length} - Total ${i + chunkSize}/${solcList.length}`,
        );
      }

      logger.info("Initialized compilers");
    }
    return true;
  }

  private throwIfContractIsAlreadyBeingVerified(
    chainId: string,
    address: string,
  ) {
    if (
      this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] !==
      undefined
    ) {
      logger.warn("Contract already being verified", { chainId, address });
      throw new ContractIsAlreadyBeingVerifiedError(chainId, address);
    }
  }

  public async verifyDeployed(
    checkedContract: AbstractCheckedContract,
    sourcifyChain: SourcifyChain,
    address: string,
    creatorTxHash?: string,
  ): Promise<Match> {
    const chainId = sourcifyChain.chainId.toString();
    logger.debug("VerificationService.verifyDeployed", {
      chainId,
      address,
    });
    this.throwIfContractIsAlreadyBeingVerified(chainId, address);
    this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] = true;

    const foundCreatorTxHash =
      creatorTxHash ||
      (await getCreatorTx(sourcifyChain, address)) ||
      undefined;

    /* eslint-disable no-useless-catch */
    try {
      const res = await libSourcifyVerifyDeployed(
        checkedContract,
        sourcifyChain,
        address,
        foundCreatorTxHash,
      );
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
      return res;
    } catch (e) {
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
      throw e;
    }
  }

  async getAllMetadataAndSourcesFromSolcJson(
    solc: ISolidityCompiler,
    solcJsonInput: SolidityJsonInput | VyperJsonInput,
    compilerVersion: string,
  ): Promise<PathBuffer[]> {
    if (solcJsonInput.language !== "Solidity")
      throw new Error(
        "Only Solidity is supported, the json has language: " +
          solcJsonInput.language,
      );

    const outputSelection = {
      "*": {
        "*": ["metadata"],
      },
    };
    if (!solcJsonInput.settings) {
      solcJsonInput.settings = {
        outputSelection: outputSelection,
      };
    }
    solcJsonInput.settings.outputSelection = outputSelection;
    const compiled = await solc.compile(compilerVersion, solcJsonInput);
    const metadataAndSources: PathBuffer[] = [];
    if (!compiled.contracts)
      throw new Error("No contracts found in the compiled json output");
    for (const contractPath in compiled.contracts) {
      for (const contract in compiled.contracts[contractPath]) {
        const metadata = compiled.contracts[contractPath][contract].metadata;
        const metadataPath = `${contractPath}-metadata.json`;
        metadataAndSources.push({
          path: metadataPath,
          buffer: Buffer.from(metadata),
        });
        metadataAndSources.push({
          path: `${contractPath}`,
          buffer: Buffer.from(
            solcJsonInput.sources[contractPath].content as string,
          ),
        });
      }
    }
    return metadataAndSources;
  }

  public async verifyFromCompilation(
    compilation: SolidityCompilation | VyperCompilation,
    sourcifyChain: SourcifyChain,
    address: string,
    creatorTxHash?: string,
  ): Promise<Verification> {
    const chainId = sourcifyChain.chainId.toString();
    logger.debug("VerificationService.verifyFromCompilation", {
      chainId,
      address,
    });
    this.throwIfContractIsAlreadyBeingVerified(chainId, address);
    this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] = true;

    const foundCreatorTxHash =
      creatorTxHash ||
      (await getCreatorTx(sourcifyChain, address)) ||
      undefined;

    const verification = new Verification(
      compilation,
      sourcifyChain,
      address,
      foundCreatorTxHash,
    );

    /* eslint-disable no-useless-catch */
    try {
      await verification.verify();
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
      return verification;
    } catch (e) {
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
      throw e;
    }
  }

  public async verifyFromJsonInput(
    solc: ISolidityCompiler,
    compilerVersion: string,
    jsonInput: VyperJsonInput | SolidityJsonInput,
    compilationTarget: CompilationTarget,
    sourcifyChain: SourcifyChain,
    address: string,
    creatorTxHash?: string,
  ): Promise<Verification> {
    const compilation = new SolidityCompilation(
      solc,
      compilerVersion,
      jsonInput,
      compilationTarget,
    );

    return await this.verifyFromCompilation(
      compilation,
      sourcifyChain,
      address,
      creatorTxHash,
    );
  }

  /*   public async verifyFromMetadata(
    metadata: Metadata,
    sources: PathContent[],
    sourcifyChain: SourcifyChain,
    address: string,
    creatorTxHash?: string,
  ): Promise<Verification> {
    const solidityMetadataContract = new SolidityMetadataContract(
      metadata,
      sources,
    );
    const compilation = await solidityMetadataContract.createCompilation(
      this.solc,
    );
    return await this.verifyFromCompilation(
      compilation,
      sourcifyChain,
      address,
      creatorTxHash,
    );
  } */
}
