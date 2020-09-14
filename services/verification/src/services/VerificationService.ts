import { InputData, Match, Logger, FileService } from '@ethereum-sourcify/core';
import { Injector } from './Injector';
import * as bunyan from 'bunyan';
// import MQ from '../services/Queue'; 
// import { ConfirmChannel } from 'amqplib';


export interface IVerificationService {
    findByAddress(address: string, chain: string, repository: string): Promise<Match[]>
    inject(inputData: InputData, localChainUrl: string): Promise<Match>;
}

export class VerificationService implements IVerificationService {
    fileService: FileService;
    logger: bunyan;

    constructor(fileService?: any, logger?: bunyan) {
        this.logger = logger || Logger("VerificationService");
        this.fileService = fileService || new FileService("./repository");
    }

    findByAddress = async (address: string, chain: string, repository: string) => {
        // Try to find by address, return on success.
        let matches: Match[] = [];
        try {
            matches = await this.fileService.findByAddress(address, chain, repository);
        } catch (err) {
            const msg = "Could not find file in repository"
            this.logger.info({
                loc: '[POST:VERIFICATION_BY_ADDRESS_FAILED]',
                address: address
            }, msg);
        }
        return matches;
    }

    inject = async (inputData: InputData, localChainUrl: string): Promise<Match> => {
        // Injection
        //const injection: Promise<Match>;
        //const { repository, chain, addresses, files } = inputData;
        const injector = new Injector({
            localChainUrl: localChainUrl,
            log: this.logger,
            infuraPID: process.env.INFURA_ID,
            repositoryPath: this.fileService.repositoryPath,
            fileService: this.fileService
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
