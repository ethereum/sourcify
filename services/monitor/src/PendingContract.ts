import logger from "./logger";
import { FileHash } from "./util";
import { Metadata, MetadataSourceMap } from "@ethereum-sourcify/lib-sourcify";
import { id as keccak256str } from "ethers";
import { KnownDecentralizedStorageFetchers } from "./types";
import assert from "assert";
import dotenv from "dotenv";
import { LIB_VERSION } from "./version";

dotenv.config();

export default class PendingContract {
  public metadataHash: FileHash;
  public address: string;
  public chainId: number;
  public metadata: Metadata | undefined;
  public pendingSources: MetadataSourceMap = {};
  public fetchedSources: MetadataSourceMap = {};
  private decentralizedStorageFetchers: KnownDecentralizedStorageFetchers;

  constructor(
    metadataHash: FileHash,
    address: string,
    chainId: number,
    decentralizedStorageFetchers: KnownDecentralizedStorageFetchers
  ) {
    this.metadataHash = metadataHash;
    this.address = address;
    this.chainId = chainId;
    this.decentralizedStorageFetchers = decentralizedStorageFetchers;
  }

  /**
   * Assembles this contract by first fetching its metadata and then fetching all the sources listed in the metadata.
   */
  assemble = async () => {
    const metadataFetcher =
      this.decentralizedStorageFetchers[this.metadataHash.origin];
    if (!metadataFetcher) {
      throw new Error(
        `No metadata fetcher found for origin ${this.metadataHash.origin}`
      );
    }
    const metadataStr = await metadataFetcher
      .fetch(this.metadataHash)
      .catch((err) => {
        throw new Error(
          `Can't fetch metadata for ${this.address} ${this.metadataHash.hash}: ${err}`
        );
      });
    logger.info(
      `Fetched metadata for ${this.address} on chain ${this.chainId} from ${this.metadataHash.origin}`
    );
    this.metadata = JSON.parse(metadataStr) as Metadata;
    this.pendingSources = structuredClone(this.metadata.sources); // Copy, don't mutate original.

    // Try to fetch all sources in parallel.
    const fetchPromises = Object.keys(this.pendingSources).map(
      async (sourceUnitName) => {
        const source = this.pendingSources[sourceUnitName];

        // Source already inline.
        if (source.content) {
          logger.info(
            `Source ${sourceUnitName} of ${this.address} on chain ${this.chainId} has already inline content`
          );
          this.movePendingToFetchedSources(sourceUnitName);
          return;
        }

        let fetchedContent: string | undefined;
        // There are multiple urls. Can be fetched from any of them.
        // TODO: Can url be https:// ?
        for (const url of source.urls || []) {
          const fileHash = FileHash.fromUrl(url);
          if (!fileHash) {
            logger.info(
              `No file hash found for url ${url} for contract ${this.address}`
            );
            continue;
          }
          const fetcher = this.decentralizedStorageFetchers[fileHash.origin];
          if (!fetcher) {
            logger.debug(
              `No fetcher found for origin ${fileHash.origin} for contract ${this.address}`
            );
            continue;
          }
          fetchedContent = await fetcher.fetch(fileHash);
          logger.info(
            `Fetched source ${sourceUnitName} for ${this.address} on chain ${this.chainId} from ${fileHash.origin}`
          );
          source.content = fetchedContent;
          this.movePendingToFetchedSources(sourceUnitName);
        }
      }
    );
    return Promise.all(fetchPromises);
  };

  public sendToSourcifyServer = async (
    sourcifyServerURL: string,
    creatorTxHash?: string
  ): Promise<any> => {
    // format in { "source1.sol": "Contract A { ...}", "source2.sol": "Contract B { ...}" } format
    const formattedSources: { [key: string]: string } = {};
    for (const sourceUnitName of Object.keys(this.fetchedSources)) {
      const source = this.fetchedSources[sourceUnitName];
      if (!source.content)
        throw new Error(
          `Unexpectedly empty source content when sending to Sourcify server. Contract ${this.address} on chain ${this.chainId}`
        );
      formattedSources[sourceUnitName] = source.content;
    }

    // Send to Sourcify server.
    const response = await fetch(sourcifyServerURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": LIB_VERSION,
      },
      body: JSON.stringify({
        chainId: this.chainId.toString(),
        address: this.address,
        files: {
          ...formattedSources,
          "metadata.json": JSON.stringify(this.metadata),
        },
        creatorTxHash,
      }),
    });

    if (response.status === 200) {
      logger.info(
        `Contract ${this.address} sent to Sourcify server ${sourcifyServerURL}`
      );
      return response.json();
    } else {
      throw new Error(
        `Error sending contract ${
          this.address
        } to Sourcify server ${sourcifyServerURL}: ${
          response.statusText
        } ${await response.text()}`
      );
    }
  };

  private movePendingToFetchedSources = (sourceUnitName: string) => {
    const source = this.pendingSources[sourceUnitName];
    if (!source) {
      throw new Error(`Source ${sourceUnitName} not found`);
    }
    if (!source.content) {
      throw new Error(`Source ${sourceUnitName} has no content`);
    }
    const calculatedKeccak = keccak256str(source.content);
    assert(
      calculatedKeccak === source.keccak256,
      `Keccak mismatch for ${sourceUnitName}`
    );

    this.fetchedSources[sourceUnitName] = { ...source };
    delete this.pendingSources[sourceUnitName];
  };
}
