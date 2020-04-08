import cbor from 'cbor';
import Web3 from 'web3';
import Logger from 'bunyan';

const solc: any = require('solc');

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
  return await web3.eth.getCode(address);
};


/**
 * Removes post-fixed metadata from a bytecode string
 * (for partial bytecode match comparisons )
 * @param  {string} bytecode
 * @return {string}          bytecode minus metadata
 */
export function getBytecodeWithoutMetadata(bytecode: string) : string {
  // Last 4 chars of bytecode specify byte size of metadata component,
  const metadataSize = parseInt(bytecode.slice(-4), 16) * 2 + 4;
  return bytecode.slice(0, bytecode.length - metadataSize);
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
function reformatMetadata(
  metadata : any,
  sources : StringMap,
  log: Logger
) : ReformattedMetadata {

  const input : any = {};
  let fileName : string = '';
  let contractName : string = '';

  input.settings = metadata.settings;

  for (fileName in metadata.settings.compilationTarget){
    contractName = metadata.settings.compilationTarget[fileName];
  }

  delete input['settings']['compilationTarget']

  if (contractName == '') {
    const err = new Error("Could not determine compilation target from metadata.");
    log.info({loc: '[REFORMAT]', err: err});
    throw err;
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
export async function recompile(
  metadata : any,
  sources : StringMap,
  log: Logger
) : Promise<RecompilationResult> {

  const {
    input,
    fileName,
    contractName
  } = reformatMetadata(metadata, sources, log);

  const version = metadata.compiler.version;

  log.info(
    {
      loc: '[RECOMPILE]',
      fileName: fileName,
      contractName: contractName,
      version: version
    },
    'Recompiling'
  );

  const solcjs: any = await new Promise((resolve, reject) => {
    solc.loadRemoteVersion(`v${version}`, (error: Error, soljson: any) => {
      (error) ? reject(error) : resolve(soljson);
    });
  });

  const compiled: any = solcjs.compile(JSON.stringify(input));
  const output = JSON.parse(compiled);
  const contract : any = output.contracts[fileName][contractName];

  return {
    bytecode: contract.evm.bytecode.object,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
    metadata: contract.metadata.trim()
  }
}

import fs from 'fs';

/**
 * Only for checking that files exists in path
 * @param address 
 * @param chain 
 * @param repository 
 */
export function findByAddress(address: string, chain: string, repository: string): boolean {
  const path = `${repository}/contract/${chain}/${address}`
  const normalizedPath = require("path").join(__dirname, path);
  const files = [];

  fs.readdirSync(normalizedPath).forEach((file) => {
    files.push(file)
  });

  if(files.length > 0){
    return true;
  }
  
  return false;
}
