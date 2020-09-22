import { FileObject, Match } from '../utils/types';
import { getChainId } from '../utils/utils';
import dirTree from 'directory-tree';
import path from 'path';
import fs from 'fs';
import * as bunyan from 'bunyan';

export interface IFileService {
    getTreeByChainAndAddress(chainId: any, address: string): Promise<Array<string>>;
    getByChainAndAddress(chainId: any, address: string): Promise<Array<FileObject>>;
    fetchAllFileUrls(chain: string, address: string): Array<string>;
    fetchAllFilePaths(chain: string, address: string): Array<FileObject>;
    fetchAllFileContents(chain: string, address: string): Array<FileObject>;
    findByAddress(address: string, chain: string, repository: string): Match[];
}

export class FileService implements IFileService {
    logger: bunyan;

    constructor(logger?: bunyan) {
        this.logger = logger;
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

}
