import { FileHash } from "./util";
import logger from "./logger";
import { DecentralizedStorageOrigin } from "./types";
import assert, { fail } from "assert";
import { EventEmitter } from "stream";
import { GatewayFetcher } from "./GatewayFetcher";

/**
 * Fetcher for a certain type of Decentralized Storage (e.g. IPFS)
 * Will try to fetch from multiple gateways.
 */
export default class DecentralizedStorageFetcher extends EventEmitter {
  // TODO: Run local js-ipfs.
  public origin: DecentralizedStorageOrigin;
  private gatewayFetchers: GatewayFetcher[];
  private uniqueFiles: { [key: string]: boolean } = {};
  private uniqueFilesCounter = 0;
  private subcriberCounter = 0;

  constructor(origin: DecentralizedStorageOrigin, gateways: string[]) {
    super();
    this.origin = origin;
    this.gatewayFetchers = gateways.map(
      (gatewayURL) => new GatewayFetcher(gatewayURL)
    );
  }

  fetch = (fileHash: FileHash) => {
    assert(fileHash.origin === this.origin, "Invalid origin");

    return new Promise<string>((resolve, reject) => {
      const cleanupSubscription = () => {
        this.subcriberCounter--;
        this.removeListener(`${fileHash.hash} fetched`, successListener);
        this.removeListener(`${fileHash.hash} fetch failed`, failListener);
        logger.info(
          `Removed listener for ${fileHash.hash}. \n Unique Files counter: ${this.uniqueFilesCounter} \n Subscriber counter: ${this.subcriberCounter}`
        );
      };

      // Only resolve on success or failure
      const successListener = (file: string) => {
        cleanupSubscription();
        resolve(file);
      };

      const failListener = () => {
        cleanupSubscription();
        reject(`Failed to fetch ${fileHash.hash} from ${this.origin}`);
      };

      // Subscribe to fetching of the file.
      this.on(`${fileHash.hash} fetched`, successListener);
      // Subscribe to failure of fetching the file.
      this.on(`${fileHash.hash} fetch failed`, failListener);

      // Need the file for the first time.
      if (!this.uniqueFiles[fileHash.hash]) {
        this.uniqueFiles[fileHash.hash] = true;
        this.subcriberCounter++;
        this.uniqueFilesCounter++;

        // TODO: Handle multiple gateways.
        const gatewayFetcher = this.gatewayFetchers[0];

        logger.info(
          `Fetching ${fileHash.hash} from ${gatewayFetcher.url} \n Unique Files counter: ${this.uniqueFilesCounter} \n Subscriber counter: ${this.subcriberCounter}`
        );
        gatewayFetcher
          .fetchWithRetries(fileHash.hash)
          .then((file) => {
            logger.info(`Fetched ${fileHash.hash} from ${gatewayFetcher.url}`);
            this.uniqueFilesCounter--;
            delete this.uniqueFiles[fileHash.hash];
            // Notify the subscribers
            this.emit(`${fileHash.hash} fetched`, file);
          })
          .catch((err) => {
            logger.info(
              `Failed to fetch ${fileHash.hash} from ${gatewayFetcher.url} \n ${err}`
            );
            this.uniqueFilesCounter--;
            delete this.uniqueFiles[fileHash.hash];
            // Notify the subscribers
            this.emit(`${fileHash.hash} fetch failed`);
          });
      }
      // Already trying to fetch this file. Don't fetch again. Already listening.
      else {
        this.subcriberCounter++;
        logger.info(
          `Received a fetch for ${fileHash.hash}. There's already a fetch in progress. \n Unique Files counter: ${this.uniqueFilesCounter} \n Subscriber counter: ${this.subcriberCounter}`
        );
      }
    });
  };
}
