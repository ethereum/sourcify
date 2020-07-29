import cbor from 'cbor';
import Web3 from 'web3';
import Logger from 'bunyan';
import util from 'util';
import fs from 'fs';
import path from 'path';
import dirTree from 'directory-tree';
import * as chainOptions from './chains.json';
import Injector from './injector';
import {
  BadRequest,
  NotFound,
} from './errorHandler';

const solc: any = require('solc');
export let repository = process.env.MOCK_REPOSITORY || './repository';

export let localChainUrl: string = "";

export const log = Logger.createLogger({
  name: "Server",
  streams: [{
    stream: process.stdout,
    level: 30
  }]
});

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
    log.info({ loc: '[REFORMAT]', err: err });
    throw err;
  }

  input['sources'] = {}
  for (const source in sources) {
    input.sources[source] = { 'content': sources[source] }
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
  files?: FileObject[],
  bytecode?: string
}

export function findInputFiles(files: any): any {
  const inputs: any = [];

  if (files && files.files) {

    // Case: <UploadedFile[]>
    if (Array.isArray(files.files)) {
      files.files.forEach((file: any) => {
        inputs.push({ name: file.name, content: file.data })
      })
      return inputs;

      // Case: <UploadedFile>
    } else if (files.files["data"]) {
      inputs.push({ name: files.files.name, content: files.files["data"] });
      return inputs;
    }

    // Case: default
    const msg = `Invalid file(s) detected: ${util.inspect(files.files)}`;
    log.info({ loc: '[POST:INVALID_FILE]' }, msg);
    throw new BadRequest(msg);
  }

}

export function sanitizeInputFiles(inputs: any): FileObject[] {
  const files: FileObject[] = [];
  if (!inputs.length) {
    const msg = 'Unable to extract any files. Your request may be misformatted ' +
      'or missing some contents.';

    const err = new Error(msg);
    log.info({ loc: '[POST:NO_FILES]', err: err })
    throw new BadRequest(msg)
  }

  for (const file of inputs) {
    try {
      const val = JSON.parse(file.content.toString());
      const type = Object.prototype.toString.call(val);

      (type === '[object Object]')
        ? files.push({ name: file.name, content: JSON.stringify(val) })  // JSON formatted metadata
        : files.push({ name: file.name, content: val });                 // Stringified metadata

    } catch (err) {
      files.push({ name: file.name, content: file.content.toString() })          // Solidity files
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
  const addressPath = `${repository}/contracts/full_match/${chain}/${address}/`;
  const normalizedPath = path.join('./', addressPath);

  try {
    const contractDirectory = fs.readdirSync(normalizedPath);
    const jsonFile = contractDirectory
      .filter(file => file.endsWith('.json'))
      .map(file => path.resolve(__dirname, file))
    fs.readFileSync(path.join('./', normalizedPath, jsonFile[0].substring(jsonFile[0].lastIndexOf("/") + 1)));
  } catch (e) {
    throw new Error("Address not found in repository");
  }

  return [{
    address: address,
    status: "perfect"
  }]
}

export type FileObject = {
  name: string,
  path?: string
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

export function fetchAllFilePaths(chain: string, address: string): Array<FileObject> {
  const fullPath: string = path.resolve(__dirname, `../repository/contract/${chain}/${address}/`);
  const files: Array<FileObject> = [];
  dirTree(fullPath, {}, (item) => {
    files.push({ "name": item.name, "path": item.path });
  });
  return files;
}

export function fetchAllFileContents(chain: string, address: string): Array<FileObject> {
  const files = fetchAllFilePaths(chain, address);
  for (const file in files) {
    const loadedFile = fs.readFileSync(files[file].path)
    files[file].content = loadedFile.toString();
  }

  return files;
}

export function getChainId(chain: string): string {
  for (const chainOption in chainOptions) {
    const network = chainOptions[chainOption].network;
    const chainId = chainOptions[chainOption].chainId;
    if ((network && network.toLowerCase() === chain) || String(chainId) === chain) {
      return String(chainOptions[chainOption].chainId);
    }
  }

  throw new NotFound(`Chain ${chain} not supported!`);
}

export function getChainByName(name: string): any {
  for (const chainOption in chainOptions) {
    const network = chainOptions[chainOption].network;
    if (network && network.toLowerCase() === name) {
      return chainOptions[chainOption];
    }
  }

  throw new NotFound(`Chain ${name} not supported!`)
}

import { outputFileSync } from 'fs-extra';
const saveFile = outputFileSync;

/**
 * Save file and update the repository tag
 *
 * @param path
 * @param file
 */
export function save(path: string, file: any) {
  saveFile(path, file);
  updateRepositoryTag(path.split('/')[0]);
}

type Tag = {
  timestamp: any,
  repositoryVersion: string
}

/**
 * Update repository tag
 */
export function updateRepositoryTag(repositoryPath?: string) {
  if (repositoryPath !== undefined) {
    repository = repositoryPath;
  }
  const filePath: string = path.join(repository, 'manifest.json')
  const timestamp = new Date().getTime();
  const repositoryVersion = process.env.REPOSITORY_VERSION || '0.1';
  const tag: Tag = {
    timestamp: timestamp,
    repositoryVersion: repositoryVersion
  }
  fs.writeFileSync(filePath, JSON.stringify(tag));
}

//------------------------------------------------------------------------------------------------------

export function verify(inputData: InputData, injector: Injector): any {
  console.log(process.cwd());
  // Try to find by address, return on success.
  try {
    return findByAddress(inputData.addresses[0], inputData.chain, inputData.repository);
  } catch (err) {
    const msg = "Could not find file in repository, proceeding to recompilation"
    log.info({ loc: '[POST:VERIFICATION_BY_ADDRESS_FAILED]' }, msg);
  }

  if (inputData.files.length === 0) {
    // If we reach this point, an address has been submitted and searched for
    // but there are no files associated with the request.
    const msg = 'Address for specified chain not found in repository';
    log.info({ loc: '[POST:ADDRESS_NOT_FOUND]', err: msg })
    throw new NotFound(msg);
  }

  // Try to organize files for submission, exit on error.
  inputData.files = sanitizeInputFiles(inputData.files);

  // Injection
  const promises: Promise<Match>[] = [];
  promises.push(injector.inject(inputData));

  return promises;
}

