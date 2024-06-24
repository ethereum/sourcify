import {
  verifyDeployed as libSourcifyVerifyDeployed,
  CheckedContract,
  SourcifyChainMap,
  Match,
} from "@ethereum-sourcify/lib-sourcify";
import { getCreatorTx } from "./utils/contract-creation-util";
import { ContractIsAlreadyBeingVerifiedError } from "../../common/errors/ContractIsAlreadyBeingVerifiedError";
import logger from "../../common/logger";

export interface IVerificationService {
  supportedChainsMap: SourcifyChainMap;
  verifyDeployed(
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    creatorTxHash?: string,
  ): Promise<Match>;
}

export class VerificationService implements IVerificationService {
  supportedChainsMap: SourcifyChainMap;
  activeVerificationsByChainIdAddress: {
    [chainIdAndAddress: string]: boolean;
  } = {};

  constructor(supportedChainsMap: SourcifyChainMap) {
    this.supportedChainsMap = supportedChainsMap;
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
