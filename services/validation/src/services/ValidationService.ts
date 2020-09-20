import bunyan from 'bunyan';
import { FileService, IFileService } from 'sourcify-core/build'

export interface CheckFileResponse {
  files: any,
  error: string
}

export interface IValidationService {
  validateAddresses(addresses: string[]): void; //Maybe change return to boolean?
  validateChain(chain: string): void //Maybe change return to boolean?
  checkFiles(files: any): CheckFileResponse;
}

export class ValidationService implements IValidationService {
  fileService: IFileService
    logger: bunyan;

    constructor(fileService?: IFileService, logger?: bunyan) {
        //TODO: solve logger
        //this.logger = Logger(config.logging.dir, "VerificationService");
        if(logger !== undefined){
            this.logger = logger;
        }
        this.fileService = fileService || new FileService();
    }

    checkFiles(files: any): CheckFileResponse {
      const sanitizedFiles = this.fileService.sanitizeInputFiles(this.fileService.findInputFiles(files))
      const metadataFiles = this.fileService.findMetadataFiles(sanitizedFiles);
      let sources: any = [];
      let error;
      metadataFiles.forEach(metadata => {
          try {
              sources.push(
                  {
                      metadata: metadata,
                      solidity: this.fileService.rearrangeSources(metadata, sanitizedFiles)
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

      /**
       * Throws if addresses array contains a null value (express) or is length 0
       * @param {string[] = []} addresses param (submitted to injector)
       */
      validateAddresses(addresses: string[] = []) {
        const err = new Error("Missing address for submitted sources/metadata");

        if (!addresses.length) {
          throw err;
        }

        for (const address of addresses) {
          if (address == null) throw err;
        }
      }

      /**
       * Throws if `chain` is falsy or wrong type
       * @param {string} chain param (submitted to injector)
       */
      validateChain(chain: string) {

        if (!chain || typeof chain !== 'string') {
          throw new Error("Missing chain name for submitted sources/metadata");
        }

      }
}
