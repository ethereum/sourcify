import logger from "./logger";
import SourceFetcher from "./DecentralizedStorageFetcher";
import { FileHash } from "./util";
import {
  CheckedContract,
  isEmpty,
  Metadata,
  StringMap,
} from "@ethereum-sourcify/lib-sourcify";
import { id as keccak256str } from "ethers";
import { KnownDecentralizedStorageFetchers } from "./types";
import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";

type PendingSource = {
  keccak256: string;
  content?: string;
  urls: string[];
  name: string;
};
interface PendingSourceMap {
  [keccak256: string]: PendingSource;
}

export default class PendingContract {
  public metadataHash: FileHash;
  private metadata: Metadata | undefined;
  private pendingSources: PendingSourceMap = {};
  private fetchedSources: StringMap = {};
  private fetcher: DecentralizedStorageFetcher;

  constructor(
    metadataHash: FileHash,
    decentralizedStorageFetchers: KnownDecentralizedStorageFetchers
  ) {
    this.metadataHash = metadataHash;
    const origin = metadataHash.origin;
    const fetcher = decentralizedStorageFetchers[origin];
    if (!fetcher) {
      throw new Error(`No fetcher for origin ${origin}`);
    } else {
      this.fetcher = fetcher;
    }
  }

  /**
   * Assembles this contract by first fetching its metadata and then fetching all the sources listed in the metadata.
   */
  assemble = async () => {
    const metadataStr = await this.fetcher.fetch(this.metadataHash);
  };

  // private addMetadata = (rawMetadata: string) => {
  //   this.metadata = JSON.parse(rawMetadata) as Metadata;

  //   for (const name in this.metadata.sources) {
  //     const source = JSON.parse(JSON.stringify(this.metadata.sources[name]));
  //     source.name = name;

  //     if (source.content) {
  //       this.fetchedSources[name] = source.content;
  //       continue;
  //     } else if (!source.keccak256) {
  //       logger.info(`Source ${name} has no keccak256 nor content`);
  //       break;
  //     }
  //     this.pendingSources[source.keccak256] = source;

  //     const sourceAddresses: SourceAddress[] = [];
  //     for (const url of source.urls) {
  //       const sourceAddress = SourceAddress.fromUrl(url);
  //       if (!sourceAddress) {
  //         logger.info(
  //           `Could not determine source file location for ${name} at ${url}`
  //         );
  //         continue;
  //       }
  //       sourceAddresses.push(sourceAddress);

  //       this.sourceFetcher.subscribe(sourceAddress, (sourceContent: string) => {
  //         this.addFetchedSource(sourceContent);
  //         // once source is resolved from one endpoint, others don't have to be pinged anymore, so delete them
  //         for (const deletableSourceAddress of sourceAddresses) {
  //           this.sourceFetcher.unsubscribe(deletableSourceAddress);
  //         }
  //       });
  //     }
  //   }

  //   if (isEmpty(this.pendingSources)) {
  //     const contract = new CheckedContract(this.metadata, this.fetchedSources);
  //     this.callback(contract);
  //   }
  // };

  // private addFetchedSource = (sourceContent: string) => {
  //   const hash = keccak256str(sourceContent);
  //   const source = this.pendingSources[hash];

  //   if (!source || source.name in this.fetchedSources) {
  //     return;
  //   }

  //   delete this.pendingSources[hash];
  //   this.fetchedSources[source.name] = sourceContent;

  //   if (isEmpty(this.pendingSources) && this.metadata) {
  //     const contract = new CheckedContract(this.metadata, this.fetchedSources);
  //     this.callback(contract);
  //   }
  // };
}
