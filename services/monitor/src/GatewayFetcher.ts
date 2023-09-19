import { Logger } from "winston";
import logger from "./logger";
import nodeFetch from "node-fetch";

type GatewayFetcherConfig = {
  url: string;
  fetchTimeout: number;
  fetchInterval: number;
  fetchRetries: number;
};
export class GatewayFetcher {
  public url: string;

  private fetchTimeout: number; // when to terminate a request
  private fetchInterval: number; // how much time to wait between two requests
  private retries: number; // how much time has to pass before a source is forgotten
  private gwLogger: Logger;

  constructor(config: GatewayFetcherConfig) {
    this.url = config.url;
    this.fetchTimeout = config.fetchTimeout;
    this.fetchInterval = config.fetchInterval;
    this.retries = config.fetchRetries;
    this.gwLogger = logger.child({ prefix: `GatewayFetcher ${this.url}` });
  }

  fetchWithRetries = async (fileHash: string) => {
    const fetchURL = new URL(fileHash, this.url);
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < this.retries; i++) {
      try {
        this.gwLogger.info(`Fetching ${fetchURL} attempt ${i + 1}`);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `Timeout fetching after ${this.fetchTimeout}ms at ${fetchURL}`
                )
              ),
            this.fetchTimeout
          );
        });

        // Race with gateway timeout
        const response = await Promise.race([
          nodeFetch(fetchURL),
          timeoutPromise,
        ]);
        if (response.ok) {
          const file = await response.text(); // or response.text(), response.blob() etc. depending on your use case
          return file;
        } else {
          throw new Error(
            `Received a non-ok status code while fetching from ${fetchURL}: ${response.status} ${response.statusText}`
          );
        }
      } catch (err) {
        this.gwLogger.info(
          `Failed to fetch ${fileHash} from ${this.url}, attempt ${i + 1}`
        );
        this.gwLogger.info(err);
        if (i < this.retries - 1) {
          this.gwLogger.debug(
            `Waiting ${this.fetchInterval}ms before retrying ${fetchURL}`
          );
          await sleep(this.fetchInterval);
        }
      }
    }
    throw new Error(
      `Failed to fetch ${fileHash} from ${this.url} after ${this.retries} attempts`
    );
  };
}
