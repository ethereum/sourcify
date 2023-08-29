import { Logger } from "winston";
import logger from "./logger";
import nodeFetch from "node-fetch";

export class GatewayFetcher {
  public url: string;

  private fetchTimeout: number; // when to terminate a request
  private fetchInterval: number; // how much time to wait between two requests
  private retries: number; // how much time has to pass before a source is forgotten
  private gwLogger: Logger;

  constructor(url: string) {
    this.url = url;
    this.gwLogger = logger.child({ prefix: `GatewayFetcher ${this.url}` });
    this.fetchTimeout =
      parseInt(process.env.MONITOR_FETCH_TIMEOUT || "") || 1 * 60 * 1000;
    this.fetchInterval =
      parseInt(process.env.MONITOR_FETCH_INTERVAL || "") || 3 * 1000;
    this.retries = parseInt(process.env.MONITOR_FETCH_RETRIES || "") || 5;
  }

  fetchWithRetries = async (fileHash: string) => {
    const fetchURL = new URL(fileHash, this.url);
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < this.retries; i++) {
      try {
        this.gwLogger.info(`Fetching ${fetchURL} attempt ${i + 1}`);
        const response = await nodeFetch(fetchURL);
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
