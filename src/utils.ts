import cbor from 'cbor';
import Web3 from 'web3';
import Logger from 'bunyan';
import { NextFunction, Request, Response } from "express";
import { injector, log } from './server';
import util from 'util';
import svc from 'solc-version-manager';

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

export type InputData = {
  repository: string
  chain: string,
  addresses: string[],
  files: string[],
}

export function findInputFiles(req: Request): any {
  const inputs: any = [];

  if (req.files && req.files.files) {

    // Case: <UploadedFile[]>
    if (Array.isArray(req.files.files)){
      req.files.files.forEach(file => {
        inputs.push(file.data)
      })
      return inputs;

    // Case: <UploadedFile>
    } else if (req.files.files["data"]) {
      inputs.push(req.files.files["data"]);
      return inputs;
    }

    // Case: default
    const msg = `Invalid file(s) detected: ${util.inspect(req.files.files)}`;
    log.info({loc:'[POST:INVALID_FILE]'}, msg);
    throw new BadRequest(msg);
  }

  const msg = 'Request missing expected property: "req.files.files"';
  const err = new Error(msg); //TODO: remove
  log.info({ loc:'[POST:REQUEST_MISFORMAT]', err: err })
  throw new BadRequest(err.message);
}

export function sanatizeInputFiles(inputs: any) {
  const files = [];
  if (!inputs.files.length){
    const msg = 'Unable to extract any files. Your request may be misformatted ' +
                'or missing some contents.';

    const err = new Error(msg);
    log.info({ loc:'[POST:NO_FILES]', err: err })
    throw new BadRequest(msg)
  }

  for (const data of inputs){
    try {
      const val = JSON.parse(data.toString());
      const type = Object.prototype.toString.call(val);

      (type === '[object Object]')
        ? files.push(JSON.stringify(val))  // JSON formatted metadata
        : files.push(val);                 // Stringified metadata

    } catch (err) {
      files.push(data.toString())          // Solidity files
    }

    return files as string[];
  }
}

export async function inject(inputData: InputData) {
  injector.inject(
    inputData
  ).then(result => {
    return result
  }).catch(err => {
    log.info({ loc:'[POST:INJECT_ERROR]', err: err })
    //res.status(400).send({ error: err.message })
    throw new BadRequest(err.message);
  })
}

//------------------------------------------------------------------------------------------------------
// Errors
export class HttpException extends Error {
  status?: number;
  message: string;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.message = message;
  }
}

export class BadRequest extends HttpException {
  constructor(message: string){
    super(message, 401);
  }
}

export class NotFound extends HttpException {
  constructor(message: string) {
    super(message, 404);
  }
}


export function errorMiddleware(error: Error, request: Request, response: Response, next: NextFunction) {
  if (error.message.includes("call exception")) {
    castError(new NotFound(error.message), request, response, next);
  } else if (error.message.includes("network does support") || error.message.includes("invalid input argument")) {
    castError(new BadRequest(error.message), request, response, next);
  } else {
    castError(new HttpException(error.message, 500), request, response, next);
  }
}

export function castError(error: HttpException, request: Request, response: Response, next: NextFunction) {
  const status = error.status || 500;
  const message = error.message || "Something went wrong";
  response
    .status(status)
    .send({
      message
    });
}
