import cbor from 'cbor';
import Web3 from 'web3';

const solc: any = require('solc');
const log = console.log;

declare interface StringMap {
  [key: string]: string;
}

declare interface ReformattedMetadata {
  input: any,
  fileName: string,
  contractName: string
}

export interface RecompilationResult {
  bytecode: string,
  deployedBytecode: string,
  metadata: string
}

/**
 * Extracts cbor encoded segement from bytecode
 * @example
 *   const bytes = Web3.utils.hexToBytes(evm.deployedBytecode);
 *   cborDecode(bytes);
 *   > { ipfs: "QmarHSr9aSNaPSR6G9KFPbuLV9aEqJfTk1y9B8pdwqK4Rq" }
 *
 * @param  {number[]} bytecode
 * @return {any}
 */
export function cborDecode(bytecode: number[]) : any {
  const cborLength : number = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1];
  const bytecodeBuffer = Buffer.from(bytecode.slice(bytecode.length - 2 - cborLength, -2));
  return cbor.decodeFirstSync(bytecodeBuffer);
}

/**
 * Wraps eth_getCode
 * @param {Web3}   web3    connected web3 instance
 * @param {string} address contract
 */
export async function getBytecode(web3: Web3, address: string) {
  address = web3.utils.toChecksumAddress(address);
  log(`Retrieving bytecode of contract at address ${address}...`);
  return await web3.eth.getCode(address);
};

/**
 * Wraps ens.getAddress
 * @param {Web3}   web3    connected web3 instance
 * @param {string} address ENS address
 */
export async function resolveAddress(web3: Web3, address: string) {
  console.log("Resolving ENS address at " + address + "to ethereum account...")
  return await web3.eth.ens.getAddress(address)
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
function reformatMetadata(metadata : any, sources : StringMap ) : ReformattedMetadata {
  const input : any = {};
  let fileName : string = '';
  let contractName : string = '';

  input.settings = metadata.settings;

  for (fileName in metadata.settings.compilationTarget){
    contractName = metadata.settings.compilationTarget[fileName];
  }

  delete input['settings']['compilationTarget']

  if (contractName == '') {
    throw new Error("Could not determine compilation target from metadata.");
  }

  input['sources'] = {}
  for (const source in sources){
    input.sources[source] = {'content': sources[source]}
  }

  input.language = metadata.language
  input.settings.metadata = input.settings.metadata || {}
  input.settings.outputSelection = input.settings.outputSelection || {}
  input.settings.outputSelection[fileName] = input.settings.outputSelection[fileName] || {}

  input.settings.outputSelection[fileName][contractName] = [
    'evm.bytecode',
    'evm.deployedBytecode',
    'metadata'
  ];

  return {
    input: input,
    fileName: fileName,
    contractName: contractName
  }
}

/**
 * Compiles sources using version and settings specified in metadata
 * @param  {any}                          metadata
 * @param  {string[]}                     sources  solidity files
 * @return {Promise<RecompilationResult>}
 */
export async function recompile(metadata : any, sources : StringMap) : Promise<RecompilationResult> {
  const {
    input,
    fileName,
    contractName
  } = reformatMetadata(metadata, sources);

  const version = metadata.compiler.version;

  log(`Re-compiling ${fileName}:${contractName} with Solidity ${version}`);
  log('Retrieving compiler...');

  const solcjs: any = await new Promise((resolve, reject) => {
    solc.loadRemoteVersion(`v${version}`, (error: Error, soljson: any) => {
      (error) ? reject(error) : resolve(soljson);
    });
  });

  log('Compiling...');

  const compiled: any = solcjs.compile(JSON.stringify(input));
  const output = JSON.parse(compiled);
  const contract : any = output.contracts[fileName][contractName];

  return {
    bytecode: contract.evm.bytecode.object,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
    metadata: contract.metadata.trim()
  }
}

