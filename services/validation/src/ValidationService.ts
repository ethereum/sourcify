import bunyan from 'bunyan';
import Web3 from 'web3';
import { StringMap } from 'sourcify-core'
import util from 'util';

export interface CheckFileResponse {
    files: any,
    error: string
}

export interface IValidationService {
    checkFiles(files: any): CheckFileResponse;
}

export class ValidationService implements IValidationService {
    logger: bunyan;

    constructor(logger?: bunyan) {
        this.logger = logger;
    }

    checkFiles(files: any) {
        const sanitizedFiles = this.sanitizeInputFiles(this.findInputFiles(files))
        const metadataFiles = this.findMetadataFiles(sanitizedFiles);
        let sources: any = [];
        let error;
        metadataFiles.forEach(metadata => {
            try {
                sources.push(
                    {
                        metadata: metadata,
                        solidity: this.rearrangeSources(metadata, sanitizedFiles)
                    })
            } catch (err) {
                error = err.message;
            }

        });
        const response: CheckFileResponse = {
            files: sources,
            error: error
        }
        return response;
    }

    private organizeFilesForSubmition(files: any) {
        const f = this.findInputFiles(files);
        return this.sanitizeInputFiles(f);
    }

    private findInputFiles(files: any): any {
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

    private sanitizeInputFiles(inputs: any): string[] {
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
    private findMetadataFiles(files: string[]): any[] {
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
    private rearrangeSources(metadata: any, files: string[]): StringMap {
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
    private storeByHash(files: string[]): StringMap {
        const byHash: StringMap = {};

        for (const i in files) {
            byHash[Web3.utils.keccak256(files[i])] = files[i]
        }
        return byHash;
    }

}