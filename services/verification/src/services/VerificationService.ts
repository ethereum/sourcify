import * as bunyan from 'bunyan';
import Web3 from 'web3';

import { InputData, Match, IFileService, StringMap, RecompilationResult, FileService } from 'sourcify-core/build';
import config from 'sourcify-core/build/utils/config';
import { Logger } from '../../../core/build/index'
import Injector from './Injector';

export interface IVerificationService {
    findByAddress(address: string, chain: string, repository: string): Promise<Match[]>
    inject(inputData: InputData): Promise<Match>;
    matchBytecodeToAddress(chain: string, addresses: string[], compiledBytecode: string): Promise<Match>;
    compareBytecodes(deployedBytecode: string | null, compiledBytecode: string): 'perfect' | 'partial' | null;
    recompile(metadata: any, sources: StringMap, log: bunyan ): Promise<RecompilationResult>
}

export class VerificationService implements IVerificationService {
    fileService: IFileService;
    logger: bunyan;

    constructor(fileService?: IFileService, logger?: bunyan) {
        this.logger = Logger(config.logging.dir, "VerificationService");
        if(logger !== undefined){
            this.logger = logger;
        }
        this.fileService = fileService || new FileService(this.logger);
    }

    findByAddress = async (address: string, chain: string, repository: string) => {
        // Try to find by address, return on success.
        let matches: Match[] = [];
        try {
            matches = this.fileService.findByAddress(address, chain, repository);
        } catch(err) {
            const msg = "Could not find file in repository, proceeding to recompilation"
            this.logger.info({loc:'[POST:VERIFICATION_BY_ADDRESS_FAILED]'}, msg);
        }
        return matches;
    }

    inject = async (inputData: InputData): Promise<Match> => {
        // Injection
        //const injection: Promise<Match>;
        //const { repository, chain, addresses, files } = inputData;

        const injector = new Injector({
            localChainUrl: config.localchain.url,
            log: this.logger,
            infuraPID: process.env.INFURA_ID || "changeinfuraid"
        });

        return injector.inject(inputData);

        //TODO:
        // const exchange = "test";
        // const topic = "test";

        //const channel: ConfirmChannel = await MQ.createChannelAndExchange(exchange, topic);
        //MQ.publishToExchange(exchange, channel, "inputdata", JSON.stringify(inputData));
        
        
        // promises.push(injector.inject(inputData));

        

        //return injection;

        // // This is so we can have multiple parallel injections, logic still has to be completely implemented
        // Promise.all(promises).then((result) => {
        //     res.status(200).send({result});
        // }).catch(err => {
        //     next(err); // Just forward it to error middelware
        // })
    }

          /**
       * Searches a set of addresses for the one whose deployedBytecode
       * matches a given bytecode string
       * @param {String[]}          addresses
       * @param {string}      deployedBytecode
       */
      async matchBytecodeToAddress(
        chain: string,
        addresses: string[] = [],
        compiledBytecode: string
      ): Promise<Match> {
        let match: Match = { address: null, status: null };

        for (let address of addresses) {
          address = Web3.utils.toChecksumAddress(address)

          let deployedBytecode: string | null = null;
          try {
            //TODO: return logger
            // this.logger.info(
            //   {
            //     loc: '[MATCH]',
            //     chain: chain,
            //     address: address
            //   },
            //   `Retrieving contract bytecode address`
            // );
            //deployedBytecode = await getBytecode(this.chains[chain].web3, address)
          } catch (e) { /* ignore */ }

          const status = this.compareBytecodes(deployedBytecode, compiledBytecode);

          if (status) {
            match = { address: address, status: status };
            break;
          }
        }
        return match;
      }

      /**
       * Returns a string description of how closely two bytecodes match. Bytecodes
       * that match in all respects apart from their metadata hashes are 'partial'.
       * Bytecodes that don't match are `null`.
       * @param  {string} deployedBytecode
       * @param  {string} compiledBytecode
       * @return {string | null}  match description ('perfect'|'partial'|null)
       */
      compareBytecodes(
        deployedBytecode: string | null,
        compiledBytecode: string
      ): 'perfect' | 'partial' | null {

        if (deployedBytecode && deployedBytecode.length > 2) {
          if (deployedBytecode === compiledBytecode) {
            return 'perfect';
          }

          // if (trimMetadata(deployedBytecode) === trimMetadata(compiledBytecode)) {
          //   return 'partial';
          // }
        }
        return null;
      }

        /**
     * Compiles sources using version and settings specified in metadata
     * @param  {any}                          metadata
     * @param  {string[]}                     sources  solidity files
     * @return {Promise<RecompilationResult>}
     */
    async recompile(
        metadata: any,
        sources: StringMap,
        log: bunyan
    ): Promise<RecompilationResult> {

        const {
            input,
            fileName,
            contractName
        } = this.validationService.reformatMetadata(metadata, sources, log);

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


}
