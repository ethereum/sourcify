import { FileObject } from '../../common/types';
import dirTree from 'directory-tree';
import config from '../../config'
import fs from 'fs';
import * as chainOptions from '../../chains.json';
import { Match } from '../../common/types';
import { NotFoundError, BadRequestError } from '../../common/errors';
import { Logger } from '../../utils/logger/Logger';
import * as bunyan from 'bunyan';
import { FileArray } from 'express-fileupload';
import util from 'util';

export interface IFileService {
    getTreeByChainAndAddress(chainId: any, address: string): Promise<Array<string>>;
    getByChainAndAddress(chainId: any, address: string): Promise<Array<FileObject>>;
    fetchAllFileUrls(chain: string, address: string): Array<string>;
    fetchAllFilePaths(chain: string, address: string): Array<FileObject>;
    fetchAllFileContents(chain: string, address: string): Array<FileObject>;
    findInputFiles(files: FileArray): any;
    sanitizeInputFiles(inputs: any): string[];
    findByAddress(address: string, chain: string, repository: string): Match[];
    getChainId(chain: string): string;
    getChainByName(name: string): any;
    getIdFromChainName(chain: string): number;
}

export class FileService implements IFileService {
    logger: bunyan;

    constructor(logger?: bunyan) {
      this.logger = logger || Logger("FileService");
    }

    async getTreeByChainAndAddress(chainId: any, address: string): Promise<string[]> {
        chainId = this.getChainId(chainId);
        return this.fetchAllFileUrls(chainId, address);
    }
    
    async getByChainAndAddress(chainId: any, address: string): Promise<FileObject[]> {
        chainId = this.getChainId(chainId);
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
      
    fetchAllFilePaths(chain: string, address: string): Array<FileObject>{
        const fullPath: string = config.repository.path + `/contracts/full_match/${chain}/${address}/`;
        const files: Array<FileObject> = [];
        dirTree(fullPath, {}, (item) => {
          files.push({"name": item.name, "path": item.path});
        });
        return files;
      }
      
    fetchAllFileContents(chain: string, address: string): Array<FileObject>{
        const files = this.fetchAllFilePaths(chain, address);
          for(const file in files){
            const loadedFile = fs.readFileSync(files[file].path)
            files[file].content = loadedFile.toString();
        }

        return files;    
    }

    findInputFiles(files: FileArray): any {
      const inputs: any = [];
    
      if (files && files.files) {
        // Case: <UploadedFile[]>
        if (Array.isArray(files.files)) {
          files.files.forEach(file => {
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
        this.logger.info({loc: '[POST:INVALID_FILE]'}, msg);
        throw new BadRequestError(msg);
      }
    
      // If we reach this point, an address has been submitted and searched for
      // but there are no files associated with the request.
      const msg = 'Address for specified chain not found in repository';
      this.logger.info({loc: '[POST:ADDRESS_NOT_FOUND]', err: msg})
      throw new NotFoundError(msg);
    }
    
    sanitizeInputFiles(inputs: any): string[] {
      const files = [];
      if (!inputs.length) {
        const msg = 'Unable to extract any files. Your request may be misformatted ' +
                    'or missing some contents.';
    
        const err = new Error(msg);
        this.logger.info({loc: '[POST:NO_FILES]', err: err})
        throw new BadRequestError(msg)
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
     * Only for checking that filess exists in path
     * @param address
     * @param chain
     * @param repository
     */
    findByAddress(address: string, chain: string, repository: string): Match[] {
      const addressPath = `${repository}/contracts/full_match/${chain}/${address}/metadata.json`;
          
      try {
        fs.readFileSync(addressPath);
      } catch(e){
        throw new Error("Address not found in repository");
      }
    
      return [{
        address: address,
        status: "perfect"
      }]
    }
    
    getChainId(chain: string): string {
      for(const chainOption in chainOptions){
          const network = chainOptions[chainOption].network;
          const chainId = chainOptions[chainOption].chainId;
          if( (network && network.toLowerCase() === chain) || String(chainId) === chain){
            return String(chainOptions[chainOption].chainId);
          }
        }
    
      throw new NotFoundError(`Chain ${chain} not supported!`);
    }

    getIdFromChainName(chain: string): number {
      for(const chainOption in chainOptions) {
        if(chainOptions[chainOption].network === chain){
          return chainOptions[chainOption].chainId;
        }
      }
      throw new NotFoundError("Chain not found!"); //TODO: should we throw an error here or just let it pass?
    }
    
    getChainByName(name: string): any {
      for(const chainOption in chainOptions) {
        const network = chainOptions[chainOption].network;
        if(network && network.toLowerCase() === name){
          return chainOptions[chainOption];
        }
      }
    
      throw new NotFoundError(`Chain ${name} not supported!`)
    }

}
