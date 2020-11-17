import { StringMap } from '@ethereum-sourcify/core';
import SourceFetcher from './source-fetcher';
import { SourceAddress } from "./util";
import Logger from 'bunyan';
import Web3 from 'web3';
import { CheckedContract, isEmpty } from '@ethereum-sourcify/core';

type PendingSource = { keccak256: string, urls: string[], name: string };
interface PendingSourceMap {
    [keccak256: string]: PendingSource;
}
type Metadata = { sources: PendingSourceMap };

export default class PendingContract {
    private metadata: Metadata;
    private pendingSources: PendingSourceMap;
    private fetchedSources: StringMap = {};
    private sourceFetcher: SourceFetcher;
    private callback: (contract: CheckedContract) => void;
    private logger = new Logger({ name: "Pending Contract" });

    constructor(sourceFetcher: SourceFetcher, callback: (checkedContract: CheckedContract) => void) {
        this.sourceFetcher = sourceFetcher;
        this.callback = callback;
    }

    /**
     * Assembles this contract by first fetching its metadata and then fetching all the sources listed in the metadata.
     * 
     * @param metadataAddress an object representing the location of the contract metadata
     */
    assemble(metadataAddress: SourceAddress) {
        this.sourceFetcher.subscribe(metadataAddress, this.addMetadata);
    }

    private addMetadata = (rawMetadata: string) => {
        this.metadata = JSON.parse(rawMetadata);
        this.pendingSources = {};

        const count = Object.keys(this.metadata.sources).length;
        this.logger.info({ loc: "[PENDING_CONTRACT:ADD_METADATA]", count }, "New pending files");

        for (const name in this.metadata.sources) {
            const source = this.metadata.sources[name];
            source.name = name;
            this.pendingSources[source.keccak256] = source;

            for (const url of source.urls) { // TODO make this more efficient; this might leave unnecessary subscriptions hanging
                const sourceAddress = SourceAddress.fromUrl(url);
                if (!sourceAddress) {
                    this.logger.error(
                        { loc: "[ADD_METADATA]", url, name },
                        "Could not determine source file location"
                    );
                    continue;
                }
                this.sourceFetcher.subscribe(sourceAddress, this.addFetchedSource);
            }
        }
    }

    private addFetchedSource = (sourceContent: string) => {
        const hash = Web3.utils.keccak256(sourceContent);
        const source = this.pendingSources[hash];

        if (!source || source.name in this.fetchedSources) {
            return;
        }

        delete this.pendingSources[hash];
        this.fetchedSources[source.name] = sourceContent;

        if (isEmpty(this.pendingSources)) {
            const contract = new CheckedContract(this.metadata, this.fetchedSources);
            this.callback(contract);
        }
    }
}