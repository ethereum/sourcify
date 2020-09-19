import { FileObject, getChainId, Match, Logger } from '../index';
import Web3 from 'web3';
import { RecompilationResult, StringMap, cborDecode } from '../index';
import dirTree from 'directory-tree';
import path from 'path';
import fs from 'fs';
import config from '../utils/config';
import * as bunyan from 'bunyan';
import util from 'util';
const multihashes: any = require('multihashes');

export interface IFileService {
  getTreeByChainAndAddress(chainId: any, address: string): Promise<Array<string>>;
  getByChainAndAddress(chainId: any, address: string): Promise<Array<FileObject>>;
  fetchAllFileUrls(chain: string, address: string): Array<string>;
  fetchAllFilePaths(chain: string, address: string): Array<FileObject>;
  fetchAllFileContents(chain: string, address: string): Array<FileObject>;
  findByAddress(address: string, chain: string, repository: string): Match[];
  saveFilesToTempFolder(files: any): boolean;
  storePerfectMatchData(repository: string, chain: string, address: string, compilationResult: RecompilationResult, sources: StringMap): void
  storePartialMatchData(repository: string, chain: string, address: string, compilationResult: RecompilationResult, sources: StringMap): void 
  organizeFilesForSubmition(files: any): string[]; //Can be moved to verification or validation service?
  findInputFiles(files: any): any;
  sanitizeInputFiles(inputs: any): string[];
  findMetadataFiles(files: string[]): any[];
  rearrangeSources(metadata: any, files: string[]): StringMap; //Move to validation service?
  storeByHash(files: string[]): StringMap;
}

export class FileService implements IFileService {
  logger: bunyan;

  constructor(logger?: bunyan) {
    this.logger = logger || Logger(config.logging.dir, "FileService");
  }

  async getTreeByChainAndAddress(chainId: any, address: string): Promise<string[]> {
    chainId = getChainId(chainId);
    return this.fetchAllFileUrls(chainId, address);
  }

  async getByChainAndAddress(chainId: any, address: string): Promise<FileObject[]> {
    chainId = getChainId(chainId);
    return this.fetchAllFileContents(chainId, address);
  }

  fetchAllFileUrls(chain: string, address: string): Array<string> {
    const files: Array<FileObject> = this.fetchAllFilePaths(chain, address);
    const urls: Array<string> = [];
    files.forEach((file) => {
      const relativePath = file.path.split('/repository')[1].substr(1);
      urls.push(`${process.env.REPOSITORY_URL}${relativePath}`);
    });
    return urls;
  }

  fetchAllFilePaths(chain: string, address: string): Array<FileObject> {
    const fullPath: string = path.resolve(__dirname, `../../../repository/contract/${chain}/${address}/`);
    const files: Array<FileObject> = [];
    dirTree(fullPath, {}, (item) => {
      files.push({ "name": item.name, "path": item.path });
    });
    return files;
  }

  fetchAllFileContents(chain: string, address: string): Array<FileObject> {
    const files = this.fetchAllFilePaths(chain, address);
    for (const file in files) {
      const loadedFile = fs.readFileSync(files[file].path)
      files[file].content = loadedFile.toString();
    }

    return files;
  }

  /**
   * Only for checking that filess exists in path
   * @param address
   * @param chain
   * @param repository
   */
  findByAddress(address: string, chain: string, repository: string): Match[] {
    const addressPath = `${repository}/contracts/full_match/${chain}/${address}/metadata.json`;

    try {
      fs.readFileSync(addressPath);
    } catch (e) {
      throw new Error("Address not found in repository");
    }

    return [{
      address: address,
      status: "perfect"
    }]
  }

  /**
   * TODO:
   * @param files 
   */
  saveFilesToTempFolder(files: any): boolean{
    if(!fs.existsSync(config.tempFolder)){
      fs.mkdirSync(config.tempFolder);
    }

    return true;

  }

  /**
   * Writes verified sources to repository by address and by ipfs | swarm hash
   * @param {string}              repository        repository root (ex: 'repository')
   * @param {string}              chain             chain name (ex: 'ropsten')
   * @param {string}              address           contract address
   * @param {RecompilationResult} compilationResult solc output
   * @param {StringMap}           sources           'rearranged' sources
   */
  storePerfectMatchData(
    repository: string,
    chain: string,
    address: string,
    compilationResult: RecompilationResult,
    sources: StringMap
  ): void {

    let metadataPath: string;
    const bytes = Web3.utils.hexToBytes(compilationResult.deployedBytecode);
    const cborData = cborDecode(bytes);

    if (cborData['bzzr0']) {
      metadataPath = `/swarm/bzzr0/${Web3.utils.bytesToHex(cborData['bzzr0']).slice(2)}`;
    } else if (cborData['bzzr1']) {
      metadataPath = `/swarm/bzzr1/${Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)}`;
    } else if (cborData['ipfs']) {
      metadataPath = `/ipfs/${multihashes.toB58String(cborData['ipfs'])}`;
    } else {
      const err = new Error(
        "Re-compilation successful, but could not find reference to metadata file in cbor data."
      );

      this.logger.info({
        loc: '[STOREDATA]',
        address: address,
        chain: chain,
        err: err
      });

      throw err;
    }

    const hashPath = path.join(repository, metadataPath);
    const addressPath = path.join(
      repository,
      'contracts',
      'full_match',
      chain,
      address,
      '/metadata.json'
    );

    // save(hashPath, compilationResult.metadata);
    // save(addressPath, compilationResult.metadata);

    for (const sourcePath in sources) {

      const sanitizedPath = sourcePath
        .replace(/[^a-z0-9_.\/-]/gim, "_")
        .replace(/(^|\/)[.]+($|\/)/, '_');

      const outputPath = path.join(
        repository,
        'contracts',
        'full_match',
        chain,
        address,
        'sources',
        sanitizedPath
      );

      //save(outputPath, sources[sourcePath]);
    }
  }

  /**
   * Writes verified sources to repository by address under the "partial_match" folder.
   * This method used when recompilation bytecode matches deployed *except* for their
   * metadata components.
   * @param {string}              repository        repository root (ex: 'repository')
   * @param {string}              chain             chain name (ex: 'ropsten')
   * @param {string}              address           contract address
   * @param {RecompilationResult} compilationResult solc output
   * @param {StringMap}           sources           'rearranged' sources
   */
  storePartialMatchData(
    repository: string,
    chain: string,
    address: string,
    compilationResult: RecompilationResult,
    sources: StringMap
  ): void {

    const addressPath = path.join(
      repository,
      'contracts',
      'partial_match',
      chain,
      address,
      '/metadata.json'
    );

    //save(addressPath, compilationResult.metadata);

    for (const sourcePath in sources) {

      const sanitizedPath = sourcePath
        .replace(/[^a-z0-9_.\/-]/gim, "_")
        .replace(/(^|\/)[.]+($|\/)/, '_');

      const outputPath = path.join(
        repository,
        'contracts',
        'partial_match',
        chain,
        address,
        'sources',
        sanitizedPath
      );

      //save(outputPath, sources[sourcePath]);
    }
  }

  organizeFilesForSubmition(files: any) {
    const f = this.findInputFiles(files);
    return this.sanitizeInputFiles(f);
  }

  findInputFiles(files: any): any {
    const inputs: any = [];

    if (files && files.files) {
        // Case: <UploadedFile[]>
        if (Array.isArray(files.files)) {
            files.files.forEach((file: { data: any; }) => {
                inputs.push(file.data)
            })
            return inputs;

            // Case: <UploadedFile>
        } else if (files.files["data"]) {
            inputs.push(files.files["data"]);
            return inputs;
        }

        // Case: default
        const msg = `Invalid file(s) detected: ${util.inspect(files.files)}`;
        throw new Error(msg);
    } else if (files) {
        files.forEach((file: { data: any; }) => {
            inputs.push(file.data);
        });

        return inputs;
    }

    // If we reach this point, an address has been submitted and searched for
    // but there are no files associated with the request.
    const msg = 'Address for specified chain not found in repository';
    throw new Error(msg);
  }

  sanitizeInputFiles(inputs: any): string[] {
    const files = [];
    if (!inputs.length) {
        const msg = 'Unable to extract any files. Your request may be misformatted ' +
            'or missing some contents.';

        throw new Error(msg);

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
  * Selects metadata files from an array of files that may include sources, etc
  * @param  {string[]} files
  * @return {string[]}         metadata
  */
  findMetadataFiles(files: string[]): any[] {
    const metadataFiles = [];

    for (const i in files) {
        try {
            const m = JSON.parse(files[i])

            // TODO: this might need a stronger validation check.
            //       many assumptions are made about structure of
            //       metadata object after this selection step.
            if (m['language'] === 'Solidity') {
                metadataFiles.push(m);
            }
        } catch (err) { /* ignore */ }
    }

    if (!metadataFiles.length) {
        throw new Error("Metadata file not found. Did you include \"metadata.json\"?");
    }

    return metadataFiles;
  }

  /**
  * Validates metadata content keccak hashes for all files and
  * returns mapping of file contents by file name
  * @param  {any}       metadata
  * @param  {string[]}  files    source files
  * @return {StringMap}
  */
  rearrangeSources(metadata: any, files: string[]): StringMap {
    const sources: StringMap = {}
    const byHash = this.storeByHash(files);

    for (const fileName in metadata.sources) {
        let content: string = metadata.sources[fileName].content;
        const hash: string = metadata.sources[fileName].keccak256;
        if (content) {
            if (Web3.utils.keccak256(content) != hash) {
                throw new Error(`Invalid content for file ${fileName}`);
            }
        } else {
            content = byHash[hash];
        }
        if (!content) {
            throw new Error(`The metadata file mentions a source file called "${fileName}" ` +
                `that cannot be found in your upload.\nIts keccak256 hash is ${hash}. ` +
                `Please try to find it and include it in the upload.`);
        }
        sources[fileName] = content;
    }
    return sources;
  }

  /**
  * Generates a map of files indexed by the keccak hash of their contents
  * @param  {string[]}  files sources
  * @return {StringMap}
  */
  storeByHash(files: string[]): StringMap {
    const byHash: StringMap = {};

    for (const i in files) {
        byHash[Web3.utils.keccak256(files[i])] = files[i]
    }
    return byHash;
  }

}
