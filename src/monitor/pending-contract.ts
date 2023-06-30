import SourceFetcher from "./source-fetcher";
import { SourceAddress } from "./util";
import {
  CheckedContract,
  isEmpty,
  Metadata,
  StringMap,
} from "@ethereum-sourcify/lib-sourcify";
import { SourcifyEventManager } from "../common/SourcifyEventManager/SourcifyEventManager";
import { id as keccak256str } from "ethers";

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
  private metadata: Metadata | undefined;
  private pendingSources: PendingSourceMap = {};
  private fetchedSources: StringMap = {};
  private sourceFetcher: SourceFetcher;
  private callback: (contract: CheckedContract) => void;

  constructor(
    sourceFetcher: SourceFetcher,
    callback: (checkedContract: CheckedContract) => void
  ) {
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
    this.metadata = JSON.parse(rawMetadata) as Metadata;

    for (const name in this.metadata.sources) {
      const source = JSON.parse(JSON.stringify(this.metadata.sources[name]));
      source.name = name;

      if (source.content) {
        this.fetchedSources[name] = source.content;
        continue;
      } else if (!source.keccak256) {
        SourcifyEventManager.trigger("Monitor.Error", {
          message: `Source ${name} has no keccak256 nor content`,
        });
        break;
      }
      this.pendingSources[source.keccak256] = source;

      const sourceAddresses: SourceAddress[] = [];
      for (const url of source.urls) {
        const sourceAddress = SourceAddress.fromUrl(url);
        if (!sourceAddress) {
          SourcifyEventManager.trigger("Monitor.Error", {
            message: `Could not determine source file location for ${name} at ${url}`,
          });
          continue;
        }
        sourceAddresses.push(sourceAddress);

        this.sourceFetcher.subscribe(sourceAddress, (sourceContent: string) => {
          this.addFetchedSource(sourceContent);
          // once source is resolved from one endpoint, others don't have to be pinged anymore, so delete them
          for (const deletableSourceAddress of sourceAddresses) {
            this.sourceFetcher.unsubscribe(deletableSourceAddress);
          }
        });
      }
    }

    if (isEmpty(this.pendingSources)) {
      const contract = new CheckedContract(this.metadata, this.fetchedSources);
      this.callback(contract);
    }
  };

  private addFetchedSource = (sourceContent: string) => {
    const hash = keccak256str(sourceContent);
    const source = this.pendingSources[hash];

    if (!source || source.name in this.fetchedSources) {
      return;
    }

    delete this.pendingSources[hash];
    this.fetchedSources[source.name] = sourceContent;

    if (isEmpty(this.pendingSources) && this.metadata) {
      const contract = new CheckedContract(this.metadata, this.fetchedSources);
      this.callback(contract);
    }
  };
}
