import {
  verifyDeployed,
  CheckedContract,
  SourcifyChainMap,
  Match,
  ContextVariables,
} from "@ethereum-sourcify/lib-sourcify";
import { supportedChainsMap } from "../../sourcify-chains";

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

    return verifyDeployed(
      checkedContract,
      sourcifyChain,
      address,
      contextVariables,
      creatorTxHash
    );
  }
}
