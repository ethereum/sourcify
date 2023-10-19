import {
  verifyDeployed,
  CheckedContract,
  SourcifyChainMap,
  Match,
  /* ContextVariables, */
} from "@ethereum-sourcify/lib-sourcify";
import { getCreatorTx } from "./VerificationService-util";
import { ContractIsAlreadyBeingVerifiedError } from "../../common/errors/ContractIsAlreadyBeingVerifiedError";
import { logger } from "../../common/loggerLoki";

export interface IVerificationService {
  supportedChainsMap: SourcifyChainMap;
  verifyDeployed(
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    /* contextVariables?: ContextVariables, */
    creatorTxHash?: string
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
    address: string
  ) {
    if (
      this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] !==
      undefined
    ) {
      logger.warn(
        `The contract ${address} on chainId ${chainId} is already being verified, please wait`
      );
      throw new ContractIsAlreadyBeingVerifiedError(chainId, address);
    }
  }

  public async verifyDeployed(
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    /* contextVariables?: ContextVariables, */
    creatorTxHash?: string
  ): Promise<Match> {
    this.throwIfContractIsAlreadyBeingVerified(chainId, address);
    this.activeVerificationsByChainIdAddress[`${chainId}:${address}`] = true;

    const sourcifyChain = this.supportedChainsMap[chainId];
    let match;
    try {
      match = await verifyDeployed(
        checkedContract,
        sourcifyChain,
        address,
        /* contextVariables, */
        creatorTxHash
      );
      return match;
    } catch (err) {
      // Find the creator tx if it wasn't supplied and try verifying again with it.
      if (
        !creatorTxHash &&
        err instanceof Error &&
        err.message === "The deployed and recompiled bytecode don't match."
      ) {
        const foundCreatorTxHash = await getCreatorTx(sourcifyChain, address);
        if (foundCreatorTxHash) {
          match = await verifyDeployed(
            checkedContract,
            sourcifyChain,
            address,
            /* contextVariables, */
            foundCreatorTxHash
          );
          return match;
        }
      }
      throw err;
    } finally {
      delete this.activeVerificationsByChainIdAddress[`${chainId}:${address}`];
    }
  }
}
