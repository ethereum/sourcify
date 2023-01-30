import { checkChainId } from "../../sourcify-chains";
import web3 from "web3";

export function isValidAddress(address: string) {
  return web3.utils.isAddress(address);
}

export function isValidChain(chain: string): any {
  try {
    if (checkChainId(chain) !== undefined) {
      return true;
    }
  } catch (err: any) {
    undefined;
  }
  return false;
}
