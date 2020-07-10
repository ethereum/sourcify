
const web3 = require('web3');
export function isValidAddress(address: string) {
   return web3.utils.isAddress(address);
}

export function isValidChain(chain: string, fileservice: any): any {
   if(fileservice.getChainId(chain) !== undefined){
       return true;
   }
   return false;
}

