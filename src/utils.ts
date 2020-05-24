import cbor from 'cbor';
import Web3 from 'web3';
import Logger from 'bunyan';
import {NextFunction, Request, Response} from "express";
import util from 'util';
import fs from 'fs';
import path from 'path';
import dirTree from 'directory-tree';
import * as chainOptions from './chains.json';

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

export interface Match {
  address: string | null,
  status: 'perfect' | 'partial' | null
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
export function cborDecode(bytecode: number[]): any {
  const cborLength: number = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1];
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
export function getBytecodeWithoutMetadata(bytecode: string): string {
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
  metadata: any,
  sources: StringMap,
  log: Logger
): ReformattedMetadata {

  const input: any = {};
  let fileName: string = '';
  let contractName: string = '';

  input.settings = metadata.settings;

  for (fileName in metadata.settings.compilationTarget) {
    contractName = metadata.settings.compilationTarget[fileName];
  }

  delete input['settings']['compilationTarget']

  if (contractName == '') {
    const err = new Error("Could not determine compilation target from metadata.");
    log.info({loc: '[REFORMAT]', err: err});
    throw err;
  }

  input['sources'] = {}
  for (const source in sources) {
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
  metadata: any,
  sources: StringMap,
  log: Logger
): Promise<RecompilationResult> {

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
  const contract: any = output.contracts[fileName][contractName];

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
  bytecode?: string
}

export function findInputFiles(req: Request, log: Logger): any {
  const inputs: any = [];

  if (req.files && req.files.files) {

    // Case: <UploadedFile[]>
    if (Array.isArray(req.files.files)) {
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
    log.info({loc: '[POST:INVALID_FILE]'}, msg);
    throw new BadRequest(msg);
  }

  // If we reach this point, an address has been submitted and searched for
  // but there are no files associated with the request.
  const msg = 'Address for specified chain not found in repository';
  log.info({loc: '[POST:ADDRESS_NOT_FOUND]', err: msg})
  throw new NotFound(msg);
}

export function sanitizeInputFiles(inputs: any, log: Logger): string[] {
  const files = [];
  if (!inputs.length) {
    const msg = 'Unable to extract any files. Your request may be misformatted ' +
                'or missing some contents.';

    const err = new Error(msg);
    log.info({loc: '[POST:NO_FILES]', err: err})
    throw new BadRequest(msg)
  }

  for (const data of inputs) {
    try {
      const val = JSON.parse(data.toString());
      const type = Object.prototype.toString.call(val);

      (type === '[object Object]')
        ? files.push(JSON.stringify(val))  // JSON formatted metadata
        : files.push(val);                 // Stringified metadata

    } catch (err) {
      files.push(data.toString())          // Solidity files
    }

  }
  return files;
}

/**
 * Only for checking that files exists in path
 * @param address
 * @param chain
 * @param repository
 */
export function findByAddress(address: string, chain: string, repository: string): Match[] {
  const addressPath = `${repository}/contract/${chain}/${address}/metadata.json`;
  const normalizedPath = path.join(__dirname, '..', addressPath);

  try {
    fs.readFileSync(normalizedPath);
  } catch(e){
    throw new Error("Address not found in repository");
  }

  return [{
    address: address,
    status: "perfect"
  }]
}

export type FileObject = {
  name: string,
  path: string
  content?: string
}

export function fetchAllFileUrls(chain: string, address: string): Array<string> {
  const files: Array<FileObject> = fetchAllFilePaths(chain, address);
  const urls: Array<string> = [];
  files.forEach((file) => {
    const relativePath = file.path.split('/repository')[1].substr(1);
    urls.push(`${process.env.REPOSITORY_URL}${relativePath}`);
  });
  return urls;
}

export function fetchAllFilePaths(chain: string, address: string): Array<FileObject>{
  const fullPath: string = path.resolve(__dirname, `../repository/contract/${chain}/${address}/`);
  const files: Array<FileObject> = [];
  dirTree(fullPath, {}, (item) => {
    files.push({"name": item.name, "path": item.path});
  });
  return files;
}

export function fetchAllFileContents(chain: string, address: string): Array<FileObject>{
  const files = fetchAllFilePaths(chain, address);
    for(const file in files){
      const loadedFile = fs.readFileSync(files[file].path)
      files[file].content = loadedFile.toString();
    }

    return files;
}

export function getChainId(chain: string): string {
  for(const chainOption in chainOptions){
      const network = chainOptions[chainOption].network;
      const chainId = chainOptions[chainOption].chainId;
      if( (network && network.toLowerCase() === chain) || String(chainId) === chain){
        return String(chainOptions[chainOption].chainId);
      }
    }

  throw new NotFound(`Chain ${chain} not supported!`);
}

export function getChainByName(name: string): any {
  for(const chainOption in chainOptions) {
    const network = chainOptions[chainOption].network;
    if(network && network.toLowerCase() === name){
      return chainOptions[chainOption];
    }
  }

  throw new NotFound(`Chain ${name} not supported!`)
}

//------------------------------------------------------------------------------------------------------

// TODO: implement response middelware that will automatically handle successful and non successful (error) responses
// Errors
export class HttpException extends Error {
  status?: number;
  message: string;
  name: string;

  constructor(message: string, name: string, status?: number) {
    super(message);
    this.message = message || "Something went wrong";
    this.name = name || "HttpException";
    this.status = status || 500;
  }
}

export class BadRequest extends HttpException {
  constructor(message: string) {
    super(message, "BadRequest", 401);
  }
}

export class NotFound extends HttpException {
  constructor(message: string) {
    super(message, "NotFound", 404);
  }
}

// All Error and HttpException properties
/* tslint:disable:no-unused-variable */
export function errorMiddleware(
  error: Error & HttpException,
  request: Request,
  response: Response,
  next: NextFunction
) : void {
    const status = error.status || 500;
    const message = error.message || "Something went wrong";

    response
      .status(status)
      .send({
        error: message
      });
}
