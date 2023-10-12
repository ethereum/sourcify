import {
  verifyDeployed,
  CheckedContract,
  SourcifyChainMap,
  Match,
  /* ContextVariables, */
} from "@ethereum-sourcify/lib-sourcify";
import { getCreatorTx } from "./utils/contract-creation-util";

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

  constructor(supportedChainsMap: SourcifyChainMap) {
    this.supportedChainsMap = supportedChainsMap;
  }

  public async verifyDeployed(
    checkedContract: CheckedContract,
    chainId: string,
    address: string,
    /* contextVariables?: ContextVariables, */
    creatorTxHash?: string
  ): Promise<Match> {
    const sourcifyChain = this.supportedChainsMap[chainId];
    // lib-sourcify expects the creatorTx hash externally.
    const foundCreatorTxHash =
      creatorTxHash ||
      (await getCreatorTx(sourcifyChain, address)) ||
      undefined;
    const match = await verifyDeployed(
      checkedContract,
      sourcifyChain,
      address,
      /* contextVariables, */
      foundCreatorTxHash
    );
    return match;
  }
}
