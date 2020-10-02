import bunyan from 'bunyan';
import Web3 from 'web3';
import { Logger, StringMap } from 'sourcify-core'
import AdmZip from 'adm-zip';
import fs from 'fs';
import Path from 'path';

/**
 * Regular expression matching metadata nested within another file.
 */
const NESTED_METADATA_REGEX = /"{\\"compiler\\":{\\"version\\".*?},\\"version\\":1}"/;

/**
 * Abstraction of a checked solidity contract. With metadata and source (solidity) files.
 * The info property contains the information about compilation or errors encountered while validating the metadata.
 */
export class CheckedContract {
    metadata: any;
    solidity: StringMap;
    missing: any;

    /**
     * Contains the information about compilation or errors encountered while validating the metadata.
     */
    info: string;

    public isValid(): boolean {
        return Object.keys(this.missing).length === 0;
    }

    public constructor(metadata: any, solidity: StringMap, missing: any, info: string) {
        this.metadata = metadata;
        this.solidity = solidity;
        this.missing = missing;
        this.info = info;
    }
}

export interface IValidationService {
    checkFiles(files: Buffer[]): CheckedContract[];
}

export class ValidationService implements IValidationService {
    logger: bunyan;

    constructor(logger?: bunyan) {
        this.logger = logger || Logger("ValidationService");
    }

    checkFiles(files: Buffer[]): CheckedContract[] {
        const inputFiles = this.findInputFiles(files);
        const sanitizedFiles = this.sanitizeInputFiles(inputFiles);
        const metadataFiles = this.findMetadataFiles(sanitizedFiles);
        
        const errorMsgMaterial: string[] = [];

        let checked: CheckedContract[] = [];
        metadataFiles.forEach(metadata => {
            let info: string;
            const {foundSources, missingSources} = this.rearrangeSources(metadata, sanitizedFiles);
            if (Object.keys(missingSources).length) {
                info = this.composeErrorMessage(metadata, foundSources, missingSources);
                errorMsgMaterial.push(info);
            } else {
                info = this.composeSuccessMessage(metadata);
            }
            
            checked.push(new CheckedContract(metadata, foundSources, missingSources, info));
        });

        if (errorMsgMaterial.length) {
            const msg = errorMsgMaterial.join("\n");
            this.logger.error(msg);
        }
        
        return checked;
    }

    /**
     * Traverses the given files, unzipping any zip archive.
     * 
     * @param files the array containing the files to be checked
     * @returns an array containing the provided files, with any zips being unzipped and returned
     */
    private findInputFiles(files: Buffer[]): Buffer[] {
        const inputFiles: Buffer[] = [];
        for (const file of files) {
            if (this.isZip(file)) {
                this.unzip(file, files);
            } else {
                inputFiles.push(file);
            }
        }
        
        return inputFiles;
    }

    /**
     * Checks whether the provided file is in fact zipped.
     * @param file the buffered file to be checked
     * @returns true if the file is zipped; false otherwise
     */
    private isZip(file: Buffer): boolean {
        try {
            new AdmZip(file);
            return true;
        } catch(err) {}
        return false;
    }

    /**
     * Unzips the provided file buffer to the provided array.
     * 
     * @param zippedFile the buffer containin the zipped file to be unpacked
     * @param files the array to be filled with the content of the zip
     */
    private unzip(zippedFile: Buffer, files: Buffer[]): void {
        const timestamp = Date.now().toString();
        const tmpDir = `tmp-unzipped-${timestamp}`;
        
        new AdmZip(zippedFile).extractAllTo(tmpDir);

        this.traverseDirectoryRecursively(tmpDir, (filePath) => {
            const buff = fs.readFileSync(filePath);
            files.push(buff);
        });
        
        this.traverseDirectoryRecursively(tmpDir, fs.unlinkSync, fs.rmdirSync);
    }

    private sanitizeInputFiles(inputs: Buffer[]): string[] {
        const files = [];
        if (!inputs.length) {
            const msg = 'Unable to extract any files. Your request may be misformatted ' +
                'or missing some contents.';
            this.logger.error(msg);
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
    private findMetadataFiles(files: string[]): any[] {
        const metadataCollection = [];

        for (const file of files) {
            let metadata = this.extractMetadataFromString(file);
            if (!metadata) {
                const matchRes = file.match(NESTED_METADATA_REGEX);
                if (matchRes) {
                    metadata = this.extractMetadataFromString(matchRes[0]);
                }
            }

            if (metadata) {
                metadataCollection.push(metadata);
            }
        }

        if (!metadataCollection.length) {
            const msg = "Metadata file not found. Did you include \"metadata.json\"?";
            this.logger.error(msg);
            throw new Error(msg);
        }

        return metadataCollection;
    }

    /**
     * Validates metadata content keccak hashes for all files and
     * returns mapping of file contents by file name
     * @param  {any}       metadata
     * @param  {string[]}  files    source files
     * @return {StringMap}
     */
    private rearrangeSources(metadata: any, files: string[]): {foundSources: StringMap, missingSources: any} {
        const foundSources: StringMap = {}
        const missingSources: any = {};
        const byHash = this.storeByHash(files);

        for (const fileName in metadata.sources) {
            const sourceInfo = metadata.sources[fileName];
            let content: string = sourceInfo.content;
            const hash: string = sourceInfo.keccak256;
            if (content) {
                if (Web3.utils.keccak256(content) != hash) {
                    const msg = `Invalid content for file ${fileName}`;
                    this.logger.error(msg);
                    throw new Error(msg);
                }
            } else {
                content = byHash[hash];
            }
            
            if (content) {
                foundSources[fileName] = content;
            } else {
                missingSources[fileName] = {keccak256: hash, urls: sourceInfo.urls};
            }
        }

        return {foundSources, missingSources};
    }

    /**
     * Generates a map of files indexed by the keccak hash of their contents
     * @param  {string[]}  files sources
     * @return {StringMap}
     */
    private storeByHash(files: string[]): StringMap {
        const byHash: StringMap = {};

        for (const i in files) {
            byHash[Web3.utils.keccak256(files[i])] = files[i]
        }
        return byHash;
    }

    private extractMetadataFromString(file: string): any {
        try {
            let obj = JSON.parse(file);
            if (this.isMetadata(obj)) {
                return obj;
            }

            // if the input string originates from a file where it was double encoded (e.g. truffle)
            obj = JSON.parse(obj);
            if (this.isMetadata(obj)) {
                return obj;
            }
        } catch (err) {}
        
        return null;
    }

    /**
     * A method that checks if the provided object was generated as a metadata file of a Solidity contract.
     * Current implementation is rather simplistic and may require further engineering.
     * 
     * @param metadata the JSON to be checked
     * @returns true if the provided object is a Solidity metadata file; false otherwise
     */
    private isMetadata(obj: any): boolean {
        return obj.language === "Solidity"; // TODO
    }

    /**
     * Applies the provided worker function to the provided directory and its content.
     * 
     * @param dirPath the path of the dir to be traversed
     * @param worker the function to be applied on each file that is not a directory
     * @param after the function to be applied on the directory after traversing its children
     */
    private traverseDirectoryRecursively(dirPath: string, worker: (filePath: string) => void, after?: (filePath: string) => void) {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        fs.readdirSync(dirPath).forEach(nestedName => {
            const nestedPath = Path.join(dirPath, nestedName);
            if (fs.lstatSync(nestedPath).isDirectory()) {
                this.traverseDirectoryRecursively(nestedPath, worker, after);
            } else {
                try {
                    worker(nestedPath);
                } catch (_) {}
            }
        });

        if (after) {
            after(dirPath);
        }
    }

    private getPathAndTitleLine(metadata: any) {
        const compilationTarget = metadata.settings.compilationTarget;
        const contractPath = Object.keys(compilationTarget)[0];
        const contractTitle = compilationTarget[contractPath];
        return `${contractTitle} (${contractPath}):\n`;
    }

    /**
     * Constructs the message to be displayed in case of a successful finding
     * of source files related to the provided metadata file.
     * @param metadata 
     */
    private composeSuccessMessage(metadata: any): string {
        const compilerVersionDetailed = metadata.compiler.version;
        const compilerVersion = compilerVersionDetailed.split("+")[0];
        const pathAndTitleLine = this.getPathAndTitleLine(metadata);
        return pathAndTitleLine +
                "  Success!\n" +
                `  Compiled with Solidity ${compilerVersion}\n` +
                `  https://solc-bin.ethereum.org/wasm/soljson-v${compilerVersionDetailed}.js\n` +
                `  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v${compilerVersionDetailed}`;
    }

    private composeErrorMessage(metadata: any, foundSources: StringMap, missingSources: any): string {
        const pathAndTitleLine = this.getPathAndTitleLine(metadata);
        let msg = pathAndTitleLine +
               "  Error: Missing sources:\n" +
               "  The following files were not part in the list of files and directories provided.\n" +
               "  Please retrieve the files (potentially via ipfs) and re-run the script.\n";
        
        for (const missingSourceName in missingSources) {
            msg += `    ${missingSourceName}:\n`;
            const missingSourceProps = missingSources[missingSourceName];
            for (const prop in missingSourceProps) {
                const propValue = missingSourceProps[prop];
                if (Array.isArray(propValue)) {
                    propValue.forEach((elem: string) => {
                        msg += `      ${elem}\n`;
                    });
                } else {
                    msg += `      ${prop}: ${propValue}\n`;
                }
            }
        }
        
        const foundSourcesNumber = Object.keys(foundSources).length;
        if (foundSourcesNumber) {
            msg += `  ${foundSourcesNumber} other source files found successfully.\n`;
        }

        return msg;
    }
}