import { InputData, Match, Logger, IFileService } from '@ethereum-sourcify/core';
import { Injector } from './Injector';
import * as bunyan from 'bunyan';
import { findContractPathFromContractName, useCompiler } from '../utils';
// import MQ from '../services/Queue'; 
// import { ConfirmChannel } from 'amqplib';

export interface IVerificationService {
    findByAddress(address: string, chain: string): Match[];
    findAllByAddress(address: string, chain: string): Match[];
    inject(inputData: InputData): Promise<Match>;
    verifyWithJSON(compilerVersion: string, contractName: string, compilerJson: any) : Promise<void>;
}

export class VerificationService implements IVerificationService {
    fileService: IFileService;
    logger: bunyan;
    private injector: Injector;

    constructor(fileService: IFileService, logger?: bunyan) {
        this.fileService = fileService;
        this.logger = logger || Logger("VerificationService");
    }
    
    // TODO: Add compiler JSON interface
    verifyWithJSON = async (compilerVersion: string, contractName: string, compilerJson: any) : Promise<void> => {
        const compiled = await useCompiler(compilerVersion, compilerJson, this.logger);
        const output = JSON.parse(compiled);
        const contractPath = findContractPathFromContractName(output.contracts, contractName);
        
        if (!output.contracts || !output.contracts[contractPath] || !output.contracts[contractPath][contractName] || !output.contracts[contractPath][contractName].metadata) {
            const errorMessages = output.errors.filter((e: any) => e.severity === "error").map((e: any) => e.formattedMessage).join("\n");
            this.logger.error({ loc: "[VERIFY-WITH-JSON]", contractPath, contractName, compilerVersion, errorMessages });
            throw new Error("Compiler error:\n " + errorMessages);
            // throw new Error(RECOMPILATION_ERR_MSG);
        }
        
        const contract: any = output.contracts[contractPath][contractName];
        const metadata = contract.metadata.trim();
        console.log("METADATA is here");
        console.log(metadata);
    }

    findByAddress = (address: string, chain: string): Match[] => {
        // Try to find by address, return on success.
        let matches: Match[] = [];
        try {
            matches = this.fileService.findByAddress(address, chain);
        } catch (err) {
            const msg = "Could not find file in repository"
            this.logger.info({
                loc: '[POST:VERIFICATION_BY_ADDRESS_FAILED]',
                address: address
            }, msg);
        }
        return matches;
    }

    findAllByAddress = (address: string, chain: string): Match[] => {
        // Try to find by address, return on success.
        let matches: Match[] = [];
        try {
            matches = this.fileService.findAllByAddress(address, chain);
        } catch (err) {
            const msg = "Could not find file in repository"
            this.logger.info({
                loc: '[POST:VERIFICATION_BY_ADDRESS_FAILED]',
                address: address
            }, msg);
        }
        return matches;
    }

    inject = async (inputData: InputData): Promise<Match> => {
        // Injection
        //const injection: Promise<Match>;
        //const { repository, chain, addresses, files } = inputData;
        if (!this.injector) {
            this.injector = await Injector.createAsync({
                log: this.logger,
                repositoryPath: this.fileService.repositoryPath,
                fileService: this.fileService,
                web3timeout: parseInt(process.env.WEB3_TIMEOUT)
            });
        }

        return this.injector.inject(inputData);

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
