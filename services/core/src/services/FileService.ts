import dirTree from 'directory-tree';
import Path from 'path';
import fs from 'fs';
import web3 from 'web3';
import * as bunyan from 'bunyan';
import { FileObject, Match, Status, Tag, MatchLevel, FilesInfo, MatchQuality, ContractData } from '../utils/types';
import { getChainId } from '../utils/utils';
import { Logger } from '../utils/logger';
import rimraf from 'rimraf';

type PathConfig = {
    matchQuality: MatchQuality
    chain: string
    address: string
    fileName: string
    source?: boolean
};

export interface IFileService {
    getTreeByChainAndAddress(chainId: any, address: string): Promise<Array<string>>;
    getByChainAndAddress(chainId: any, address: string): Promise<Array<FileObject>>;
    fetchAllFileUrls(chain: string, address: string): Array<string>;
    fetchAllFilePaths(chain: string, address: string): Array<FileObject>;
    fetchAllFileContents(chain: string, address: string): Array<FileObject>;
    findByAddress(address: string, chain: string): Match[];
    findAllByAddress(address: string, chain: string): Match[];
    save(path: string | PathConfig, file: string): void;
    deletePartial(chain: string, address: string): void;
    repositoryPath: string;
    getTree(chainId: any, address: string, match: string): Promise<FilesInfo<string>>;
    getContent(chainId: any, address: string, match: string): Promise<FilesInfo<FileObject>>;
    getContracts(chainId: any): Promise<ContractData>;
}

export class FileService implements IFileService {
    logger: bunyan;
    repositoryPath: string;

    constructor(repositoryPath: string, logger?: bunyan) {
        this.repositoryPath = repositoryPath;
        this.logger = logger || Logger("FileService");
    }
    async getTreeByChainAndAddress(chainId: any, address: string): Promise<string[]> {
        chainId = getChainId(chainId);
        return this.fetchAllFileUrls(chainId, address);
    }

    async getByChainAndAddress(chainId: any, address: string): Promise<FileObject[]> {
        chainId = getChainId(chainId);
        return this.fetchAllFileContents(chainId, address);
    }

    fetchAllFileUrls(chain: string, address: string, match = "full_match"): Array<string> {
        const files: Array<FileObject> = this.fetchAllFilePaths(chain, address, match);
        const urls: Array<string> = [];
        files.forEach((file) => {
            const relativePath = file.path.split('/repository')[1].substr(1);
            urls.push(`${process.env.REPOSITORY_URL}/${relativePath}`);
        });
        return urls;
    }

    fetchAllFilePaths(chain: string, address: string, match = "full_match"): Array<FileObject> {
        const fullPath: string = this.repositoryPath + `/contracts/${match}/${chain}/${web3.utils.toChecksumAddress(address)}/`;
        const files: Array<FileObject> = [];
        dirTree(fullPath, {}, (item) => {
            files.push({ "name": item.name, "path": item.path });
        });
        return files;
    }

    fetchAllFileContents(chain: string, address: string, match = "full_match"): Array<FileObject> {
        const files = this.fetchAllFilePaths(chain, address, match);
        for (const file in files) {
            const loadedFile = fs.readFileSync(files[file].path)
            files[file].content = loadedFile.toString();
        }

        return files;
    }
    fetchAllContracts = async(chain: String): Promise<ContractData> => {
        const fullPath = this.repositoryPath + `/contracts/full_match/${chain}/`;
        const partialPath = this.repositoryPath + `/contracts/partial_match/${chain}/`;
        return {
            full: (fs.existsSync(fullPath)) ? fs.readdirSync(fullPath) : [],
            partial: (fs.existsSync(partialPath)) ? fs.readdirSync(partialPath) : []
        };
    }
    
    getTree = async (chainId: any, address: string, match: MatchLevel): Promise<FilesInfo<string>> => {
        chainId = getChainId(chainId);
        const fullMatchesTree = this.fetchAllFileUrls(chainId, address, "full_match");
        if (fullMatchesTree.length || match === "full_match") {
            return { status: "full", files: fullMatchesTree };
        }

        const files = this.fetchAllFileUrls(chainId, address, "partial_match");
        return { status: "partial", files };
    }

    getContent = async (chainId: any, address: string, match: MatchLevel): Promise<FilesInfo<FileObject>> => {
        chainId = getChainId(chainId);
        const fullMatchesFiles = this.fetchAllFileContents(chainId, address, "full_match");
        if (fullMatchesFiles.length || match === "full_match") {
            return { status: "full", files: fullMatchesFiles };
        }

        const files = this.fetchAllFileContents(chainId, address, "partial_match");
        return { status: "partial", files };
    }

    getContracts = async(chainId: any): Promise<ContractData> => {
        const contracts = await this.fetchAllContracts(chainId);
        return contracts
    }
    private generateContractPath(pathConfig: PathConfig) {
        return Path.join(
            this.repositoryPath,
            "contracts",
            `${pathConfig.matchQuality}_match`,
            pathConfig.chain,
            web3.utils.toChecksumAddress(pathConfig.address),
            pathConfig.source ? "sources" : "",
            pathConfig.fileName || ""
        );
    }

    /**
     * Checks if path exists and for a particular chain returns the perfect or partial match
     * 
     * @param fullContractPath
     * @param partialContractPath
     */
    fetchFromStorage(fullContractPath: string, partialContractPath: string): { time: Date, status: Status } {
        if (fs.existsSync(fullContractPath)) {
            return {
                time: fs.statSync(fullContractPath).birthtime,
                status: 'perfect'
            }
        }

        if (fs.existsSync(partialContractPath)) {
            return {
                time: fs.statSync(partialContractPath).birthtime,
                status: 'partial'
            }
        }

        throw new Error('path not found')
    }


    /**
     * Checks contract existence in repository.
     * 
     * @param address
     * @param chain
     * @param repository
     */
    findByAddress(address: string, chain: string): Match[] {
        const contractPath = this.generateContractPath({
            matchQuality: "full",
            chain,
            address,
            fileName: "metadata.json"
        });

        try {
            const storageTimestamp = fs.statSync(contractPath).birthtime;
            return [{
                address,
                status: "perfect",
                storageTimestamp
            }];
        } catch (e) {
            throw new Error("Address not found in repository");
        }
    }

    /**
     * Checks contract existence in repository for full and partial matches.
     * 
     * @param address
     * @param chain
     * @param repository
     */
    findAllByAddress(address: string, chain: string): Match[] {
        const fullContractPath = this.generateContractPath({
            matchQuality: "full",
            chain,
            address,
            fileName: "metadata.json"
        });

        const partialContractPath = this.generateContractPath({
            matchQuality: "partial",
            chain,
            address,
            fileName: "metadata.json"
        })

        try {

            const storage = this.fetchFromStorage(fullContractPath, partialContractPath)
            return [
                {
                    address,
                    status: storage?.status,
                    storageTimestamp: storage?.time,
                },
            ];
        } catch (e) {
            throw new Error("Address not found in repository");
        }
    }

    /**
     * Save file to repository and update the repository tag. The path may include non-existent parent directories.
     *
     * @param path the path within the repository where the file will be stored
     * @param file the content to be stored
     */
    save(path: string | PathConfig, file: string): void {
        const finalPath = (typeof path === "string") ?
            Path.join(this.repositoryPath, path) : this.generateContractPath(path);

        fs.mkdirSync(Path.dirname(finalPath), { recursive: true });
        fs.writeFileSync(finalPath, file);
        this.updateRepositoryTag();
    }

    deletePartial(chain: string, address: string): void {
        const pathConfig: PathConfig = {
            matchQuality: "partial",
            chain,
            address,
            fileName: ""
        };

        const finalPath = this.generateContractPath(pathConfig);
        rimraf(finalPath, err => {
            if (err) {
                this.logger.error({
                    loc: "[FILE_SERVICE:DELETE_PARTIAL]",
                    err: err.message,
                    chain,
                    address
                }, "Failed deleting a partial match");
            }
        });
    }

    /**
     * Update repository tag
     */
    updateRepositoryTag() {
        const filePath: string = Path.join(this.repositoryPath, 'manifest.json')
        const timestamp = new Date().getTime();
        const repositoryVersion = process.env.REPOSITORY_VERSION || '0.1';
        const tag: Tag = {
            timestamp: timestamp,
            repositoryVersion: repositoryVersion
        }
        fs.writeFileSync(filePath, JSON.stringify(tag));
    }

}
