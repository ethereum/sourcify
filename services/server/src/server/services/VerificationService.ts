import {
  SourcifyChain,
  ISolidityCompiler,
  SolidityJsonInput,
  VyperJsonInput,
  PathBuffer,
  Verification,
  SolidityCompilation,
  VyperCompilation,
  SourcifyChainMap,
  CompilationLanguage,
  VerificationExport,
  SourcifyChainInstance,
} from "@ethereum-sourcify/lib-sourcify";
import { getCreatorTx } from "./utils/contract-creation-util";
import { ContractIsAlreadyBeingVerifiedError } from "../../common/errors/ContractIsAlreadyBeingVerifiedError";
import logger from "../../common/logger";
import {
  findSolcPlatform,
  getSolcExecutable,
  getSolcJs,
} from "@ethereum-sourcify/compilers";
import { VerificationJobId } from "../types";
import { StorageService } from "./StorageService";
import {
  DuplicateVerificationRequestError,
  MatchingErrorResponse,
} from "../apiv2/errors";
import Piscina from "piscina";
import path from "path";
import { filename as verificationWorkerFilename } from "./workers/verificationWorker";
import { v4 as uuidv4 } from "uuid";
import { ConflictError } from "../../common/errors/ConflictError";

export interface VerificationServiceOptions {
  initCompilers?: boolean;
  sourcifyChainMap: SourcifyChainMap;
  solcRepoPath: string;
  solJsonRepoPath: string;
  vyperRepoPath: string;
}

export class VerificationService {
  initCompilers: boolean;
  solcRepoPath: string;
  solJsonRepoPath: string;
  storageService: StorageService;

  activeVerificationsByChainIdAddress: {
    [chainIdAndAddress: string]: boolean;
  } = {};

  private workerPool: Piscina;

  constructor(
    options: VerificationServiceOptions,
    storageService: StorageService,
  ) {
    this.initCompilers = options.initCompilers || false;
    this.solcRepoPath = options.solcRepoPath;
    this.solJsonRepoPath = options.solJsonRepoPath;
    this.storageService = storageService;

    const sourcifyChainInstanceMap = Object.entries(
      options.sourcifyChainMap,
    ).reduce(
      (acc, [chainId, chain]) => {
        acc[chainId] = chain.getSourcifyChainObj();
        return acc;
      },
      {} as Record<string, SourcifyChainInstance>,
    );

    this.workerPool = new Piscina({
      filename: path.resolve(__dirname, "./workers/workerWrapper.js"),
      workerData: {
        fullpath: verificationWorkerFilename,
        sourcifyChainInstanceMap,
        solcRepoPath: options.solcRepoPath,
        solJsonRepoPath: options.solJsonRepoPath,
        vyperRepoPath: options.vyperRepoPath,
      },
      idleTimeout: 10000, // 10 seconds idle timeout
    });
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

  private throwV1ErrorIfContractIsAlreadyBeingVerified(
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

  private throwIfContractIsAlreadyBeingVerified(
    chainId: string,
    address: string,
  ) {
    if (
      this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] !==
      undefined
    ) {
      logger.warn("Contract already being verified", { chainId, address });
      throw new DuplicateVerificationRequestError(
        `Contract ${address} on chain ${chainId} is already being verified`,
      );
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
    this.throwV1ErrorIfContractIsAlreadyBeingVerified(chainId, address);
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

    try {
      await verification.verify();
      return verification;
    } finally {
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
    }
  }

  public async verifyFromJsonInputViaWorker(
    verificationEndpoint: string,
    chainId: string,
    address: string,
    language: CompilationLanguage,
    jsonInput: SolidityJsonInput | VyperJsonInput,
    compilerVersion: string,
    contractIdentifier: string,
    creationTransactionHash?: string,
  ): Promise<VerificationJobId> {
    this.throwIfContractIsAlreadyBeingVerified(chainId, address);
    this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] = true;

    try {
      const verificationId = await this.storageService.performServiceOperation(
        "storeVerificationJob",
        [new Date(), chainId, address, verificationEndpoint],
      );

      this.workerPool
        .run(
          {
            chainId,
            address,
            language,
            jsonInput,
            compilerVersion,
            contractIdentifier,
            creationTransactionHash,
          },
          { name: "verifyFromJsonInput" },
        )
        .then((verification: VerificationExport) => {
          return this.storageService.storeVerification(verification, {
            verificationId,
            finishTime: new Date(),
          });
        })
        .catch((error) => {
          if (error.response) {
            // error comes from the verification worker
            const errorResponse = error.response as MatchingErrorResponse;
            logger.debug("Received verification error from worker", {
              verificationId,
              errorResponse,
            });
            return this.storageService.performServiceOperation("setJobError", [
              verificationId,
              new Date(),
              errorResponse,
            ]);
          }

          if (error instanceof ConflictError) {
            // returned by StorageService if match already exists and new one is not better
            return this.storageService.performServiceOperation("setJobError", [
              verificationId,
              new Date(),
              {
                customCode: "already_verified",
                errorId: uuidv4(),
              },
            ]);
          }

          logger.error("Unexpected verification error", {
            verificationId,
            error,
          });
          return this.storageService.performServiceOperation("setJobError", [
            verificationId,
            new Date(),
            {
              customCode: "internal_error",
              errorId: uuidv4(),
            },
          ]);
        });

      return verificationId;
    } finally {
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
    }
  }
}
