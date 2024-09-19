import {
  verifyDeployed as libSourcifyVerifyDeployed,
  CheckedContract,
  SourcifyChainMap,
  Match,
} from "@ethereum-sourcify/lib-sourcify";
import { getCreatorTx } from "./utils/contract-creation-util";
import { ContractIsAlreadyBeingVerifiedError } from "../../common/errors/ContractIsAlreadyBeingVerifiedError";
import logger from "../../common/logger";
import {
  findSolcPlatform,
  getSolcExecutable,
  getSolcJs,
} from "./compiler/local/solidityCompiler";

export interface VerificationServiceOptions {
  initCompilers?: boolean;
  supportedChainsMap: SourcifyChainMap;
  solcRepoPath: string;
  solJsonRepoPath: string;
}

export class VerificationService {
  initCompilers: boolean;
  supportedChainsMap: SourcifyChainMap;
  solcRepoPath: string;
  solJsonRepoPath: string;
  activeVerificationsByChainIdAddress: {
    [chainIdAndAddress: string]: boolean;
  } = {};

  constructor(options: VerificationServiceOptions) {
    this.supportedChainsMap = options.supportedChainsMap;
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
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    creatorTxHash?: string,
  ): Promise<Match> {
    logger.debug("VerificationService.verifyDeployed", {
      chainId,
      address,
    });
    this.throwIfContractIsAlreadyBeingVerified(chainId, address);
    this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] = true;

    const sourcifyChain = this.supportedChainsMap[chainId];
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
  /* eslint-enable no-useless-catch */
}
