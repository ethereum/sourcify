import { Logger } from "winston";
import logger from "./logger";
import { TimeoutError } from "./util";

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
    this.gwLogger = logger.child({ moduleName: `GatewayFetcher ${this.url}` });
  }

  fetchWithRetries = async (fileHash: string) => {
    const fetchURL = new URL(fileHash, this.url);
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let hitTimeout = false;

    for (let i = 0; i < this.retries; i++) {
      this.gwLogger.info("Fetching attempt", {
        attempt: i + 1,
        url: this.url,
        fileHash,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new TimeoutError(
                `Timeout fetching after ${this.fetchTimeout}ms at ${fetchURL}`,
              ),
            ),
          this.fetchTimeout,
        );
      });

      try {
        // Race with gateway timeout
        const response = await Promise.race([fetch(fetchURL), timeoutPromise]);

        if (response.ok) {
          const file = await response.text();
          return file;
        } else if (response.status === 504) {
          // HTTP GW Timeout
          hitTimeout = true;
        } else {
          hitTimeout = false;
          throw new Error(
            `Received a non-ok status code while fetching from ${fetchURL}: ${response.status} ${response.statusText}`,
          );
        }
      } catch (err: any) {
        if (err.timeout) {
          hitTimeout = true;
        } else {
          hitTimeout = false;
        }
        this.gwLogger.info("Failed to fetch", {
          fileHash,
          url: this.url,
          attempt: i + 1,
          err,
        });
      }

      if (i < this.retries - 1) {
        this.gwLogger.debug("Waiting before retrying", {
          fileHash,
          url: this.url,
          attempt: i + 1,
          fetchInterval: this.fetchInterval,
        });
        await sleep(this.fetchInterval);
      }
    }

    // Finally after all retries
    if (hitTimeout) {
      throw new TimeoutError(
        `Gateway timeout fetching ${fileHash} from ${this.url} after ${this.retries} attempts`,
      );
    }
    throw new Error(
      `Failed to fetch ${fileHash} from ${this.url} after ${this.retries} attempts`,
    );
  };
}
