import { CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import { StatusCodes } from "http-status-codes";
import nodeFetch from "node-fetch";
import { SourcifyEventManager } from "../common/SourcifyEventManager/SourcifyEventManager";
import { IGateway, SimpleGateway } from "./gateway";
import PendingContract from "./pending-contract";
import { SourceAddress, FetchedFileCallback } from "./util";

const STARTING_INDEX = 0;
const NO_PAUSE = 0;

class Subscription {
  sourceAddress: SourceAddress;
  fetchUrl: string;
  fallbackFetchUrl: string | undefined;
  beingProcessed = false;
  subscribers: Array<FetchedFileCallback> = [];

  constructor(
    sourceAddress: SourceAddress,
    fetchUrl: string,
    fallbackFetchUrl?: string
  ) {
    this.sourceAddress = sourceAddress;
    this.fetchUrl = fetchUrl;
    this.fallbackFetchUrl = fallbackFetchUrl;
  }

  useFallbackUrl() {
    this.fetchUrl = this.fallbackFetchUrl || this.fetchUrl;
  }
}

declare interface SubscriptionMap {
  [hash: string]: Subscription;
}

declare interface TimestampMap {
  [hash: string]: Date;
}

/**
 * A fetcher of contract source files (metadata and solidity).
 * Allows assembling a contract (collecting its sources) from the address of its metadata.
 * Allows subscribing to individual sources.
 */
export default class SourceFetcher {
  gatewayFetchers = [
    new GatewayFetcher(
      new SimpleGateway(
        ["ipfs"],
        process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/",
        "https://cloudflare-ipfs.com/ipfs/"
      )
    ),
    new GatewayFetcher(
      new SimpleGateway(
        ["bzzr0", "bzzr1"],
        "https://swarm-gateways.net/bzz-raw:/"
      )
    ),
  ];

  /**
   * Tells the fetcher not to make new requests. Doesn't affect pending requests.
   */
  stop(): void {
    this.gatewayFetchers.forEach((gatewayFetcher) => gatewayFetcher.stop());
  }

  private findGatewayFetcher(sourceAddress: SourceAddress) {
    for (const gatewayFetcher of this.gatewayFetchers) {
      if (gatewayFetcher.worksWith(sourceAddress)) {
        return gatewayFetcher;
      }
    }

    throw new Error(`Gateway not found for ${sourceAddress.origin}`);
  }

  /**
   * Fetches the requested source and executes the callback on the fetched content.
   *
   * @param sourceAddress an object representing the location of the source file
   * @param callback the callback to be called on the fetched content
   */
  subscribe(sourceAddress: SourceAddress, callback: FetchedFileCallback): void {
    const gatewayFetcher = this.findGatewayFetcher(sourceAddress);
    gatewayFetcher.subscribe(sourceAddress, callback);
  }

  /**
   * Stop fetching the source specified by the provided sourceAddress.
   *
   * @param sourceAddress
   */
  unsubscribe(sourceAddress: SourceAddress): void {
    const gatewayFetcher = this.findGatewayFetcher(sourceAddress);
    gatewayFetcher.unsubscribe(sourceAddress);
  }

  /**
   * Begins the process of assembling a contract's sources. This is done by fetching the metadata from the address provided.
   * After assembling the contract, the provided callback is called.
   *
   * @param metadataAddress an object representing the location of the contract metadata
   * @param callback the callback to be called on the contract once it is assembled
   */
  assemble(
    metadataAddress: SourceAddress,
    callback: (contract: CheckedContract) => void
  ) {
    const contract = new PendingContract(this, callback);
    contract.assemble(metadataAddress);
  }
}

class GatewayFetcher {
  private subscriptions: SubscriptionMap = {};
  private timestamps: TimestampMap = {};
  private fileCounter = 0;
  private subscriptionCounter = 0;
  private running = true;

  private fetchTimeout: number; // when to terminate a request
  private fetchPause: number; // how much time to wait between two requests
  private cleanupTime: number; // how much time has to pass before a source is forgotten

  private gateway: IGateway;

  constructor(gateway: IGateway) {
    this.gateway = gateway;
    this.fetchTimeout =
      parseInt(process.env.MONITOR_FETCH_TIMEOUT || "") || 5 * 60 * 1000;
    this.fetchPause =
      parseInt(process.env.MONITOR_FETCH_PAUSE || "") || 1 * 1000;
    this.cleanupTime =
      parseInt(process.env.MONITOR_CLEANUP_PERIOD || "") || 30 * 60 * 1000;
    this.fetch([], STARTING_INDEX);
  }

  stop(): void {
    this.running = false;
  }

  private fetch = (sourceHashes: string[], index: number): void => {
    if (index >= sourceHashes.length) {
      const newSourceHashes = Object.keys(this.subscriptions); // make a copy so that subscriptions can be freely cleared if necessary
      this.mySetTimeout(this.fetch, NO_PAUSE, newSourceHashes, STARTING_INDEX);
      return;
    }

    const sourceHash = sourceHashes[index];

    if (this.isTimeUp(sourceHash)) {
      this.cleanup(sourceHash);
    }

    const subscription = this.subscriptions[sourceHash];
    if (!subscription || subscription.beingProcessed) {
      this.mySetTimeout(this.fetch, NO_PAUSE, sourceHashes, index + 1);
      return;
    }

    subscription.beingProcessed = true;
    nodeFetch(subscription.fetchUrl, { timeout: this.fetchTimeout })
      .then((resp) => {
        resp.text().then((text) => {
          if (resp.status === StatusCodes.OK) {
            this.notifySubscribers(sourceHash, text);
          }
        });
      })
      .catch((err) => {
        if (!subscription.fallbackFetchUrl) {
          return Promise.resolve();
        }
        SourcifyEventManager.trigger("SourceFetcher.UsingFallback", {
          fetchUrl: subscription.fetchUrl,
          fallbackUrl: subscription.fallbackFetchUrl,
        });
        // fall back to external ipfs gateway
        subscription.useFallbackUrl();

        return nodeFetch(subscription.fetchUrl, {
          timeout: this.fetchTimeout,
        }).then((resp) => {
          resp.text().then((text) => {
            if (resp.status === StatusCodes.OK) {
              this.notifySubscribers(sourceHash, text);
            }
          });
        });
      })
      .catch((err) =>
        SourcifyEventManager.trigger("SourceFetcher.FetchFailed", {
          fetchUrl: subscription.fetchUrl,
          sourceHash,
        })
      )
      .finally(() => {
        subscription.beingProcessed = false;
      });

    this.mySetTimeout(this.fetch, this.fetchPause, sourceHashes, index + 1);
  };

  private mySetTimeout = (
    handler: TimerHandler,
    timeout: number,
    ...args: any[]
  ) => {
    if (this.running) {
      setTimeout(handler, timeout, ...args);
    }
  };

  private notifySubscribers(id: string, file: string) {
    if (!(id in this.subscriptions)) {
      return;
    }

    const subscription = this.subscriptions[id];
    this.cleanup(id);

    SourcifyEventManager.trigger("SourceFetcher.FetchingSuccessful", {
      fetchUrl: subscription.fetchUrl,
      id,
      subscriberCount: subscription.subscribers.length,
    });

    subscription.subscribers.forEach((callback) => callback(file));
  }

  worksWith(sourceAddress: SourceAddress): boolean {
    return this.gateway.worksWith(sourceAddress.origin);
  }

  subscribe(sourceAddress: SourceAddress, callback: FetchedFileCallback): void {
    const sourceHash = sourceAddress.getSourceHash();
    const fetchUrl = this.gateway.createUrl(sourceAddress.id);
    let fallbackFetchUrl;
    if (this.gateway.fallbackUrl)
      fallbackFetchUrl = this.gateway.createFallbackUrl(sourceAddress.id);
    if (!(sourceHash in this.subscriptions)) {
      this.subscriptions[sourceHash] = new Subscription(
        sourceAddress,
        fetchUrl,
        fallbackFetchUrl
      );
      this.fileCounter++;
    }

    this.timestamps[sourceHash] = new Date();
    this.subscriptions[sourceHash].subscribers.push(callback);

    this.subscriptionCounter++;
    SourcifyEventManager.trigger("SourceFetcher.NewSubscription", {
      fetchUrl: this.subscriptions[sourceHash].fetchUrl,
      sourceHash,
      filesPending: this.fileCounter,
      subscriptions: this.subscriptionCounter,
    });
  }

  unsubscribe(sourceAddress: SourceAddress): void {
    const sourceHash = sourceAddress.getSourceHash();
    this.cleanup(sourceHash);
  }

  private cleanup(sourceHash: string): void {
    const subscription = this.subscriptions[sourceHash];
    if (!subscription) {
      return;
    }
    const fetchUrl = subscription.fetchUrl;

    const subscribers = Object.keys(subscription.subscribers);
    const subscriptionsDelta = subscribers.length;
    delete this.subscriptions[sourceHash];

    delete this.timestamps[sourceHash];

    this.fileCounter--;
    this.subscriptionCounter -= subscriptionsDelta;
    SourcifyEventManager.trigger("SourceFetcher.Cleanup", {
      fetchUrl: fetchUrl,
      sourceHash,
      filesPending: this.fileCounter,
      subscriptions: this.subscriptionCounter,
    });
  }

  private isTimeUp(sourceHash: string): boolean {
    const subscription = this.subscriptions[sourceHash];
    if (!subscription || subscription.beingProcessed) {
      return false;
    }
    const timestamp = this.timestamps[sourceHash];
    return timestamp && timestamp.getTime() + this.cleanupTime < Date.now();
  }
}
