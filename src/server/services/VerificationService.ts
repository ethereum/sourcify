import {
  verifyDeployed,
  CheckedContract,
  SourcifyChainMap,
  Match,
  ContextVariables,
} from "@ethereum-sourcify/lib-sourcify";
import { SourcifyEventManager } from "../../common/SourcifyEventManager/SourcifyEventManager";
import { getCreatorTx } from "./VerificationService-util";

export interface IVerificationService {
  verifyDeployed(
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    contextVariables?: ContextVariables,
    creatorTxHash?: string
  ): Promise<Match>;
}
export default class VerificationService implements IVerificationService {
  supportedChainsMap: SourcifyChainMap;

  constructor(supportedChainsMap: SourcifyChainMap) {
    this.supportedChainsMap = supportedChainsMap;
  }

  public async verifyDeployed(
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    contextVariables?: ContextVariables,
    creatorTxHash?: string
  ): Promise<Match> {
    const sourcifyChain = this.supportedChainsMap[chainId];

    try {
      return verifyDeployed(
        checkedContract,
        sourcifyChain,
        address,
        contextVariables,
        creatorTxHash
      );
    } catch (err) {
      // Find the creator tx if it wasn't supplied and try verifying again with it.
      if (
        err instanceof Error &&
        err.message === "The deployed and recompiled bytecode don't match."
      ) {
        const foundCreatorTxHash = await getCreatorTx(sourcifyChain, address);
        if (foundCreatorTxHash) {
          SourcifyEventManager.trigger("Verification.CreatorTxFetched", {
            chainId: sourcifyChain.chainId.toString(),
            address: address,
          });
          return verifyDeployed(
            checkedContract,
            sourcifyChain,
            address,
            contextVariables,
            foundCreatorTxHash
          );
        }
      }
      throw err;
    }
  }
}
