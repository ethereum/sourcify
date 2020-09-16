import { InputData, Match } from '../../../services/core/build/index';
import { IFileService } from './FileService';
import * as bunyan from 'bunyan';
import config from '../../config';
import { Logger } from '../../../services/core/build/index'
// import MQ from '../services/Queue'; 
// import { ConfirmChannel } from 'amqplib';
import Injector from './Injector';

export interface IVerificationService {
    findByAddress(address: string, chain: string, repository: string): Promise<Match[]>
    inject(inputData: InputData): Promise<Match>;
}

export class VerificationService implements IVerificationService {
    fileService: IFileService;
    logger: bunyan;

    constructor(fileService: IFileService, logger?: bunyan) {
        this.logger = Logger(config.logging.dir, "VerificationService");
        if(logger !== undefined){
            this.logger = logger;
        }
        this.fileService = fileService;
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

}
