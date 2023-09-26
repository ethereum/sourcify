import { FileHash } from "./util";
import { Block, TransactionResponse, getCreateAddress } from "ethers";
import assert from "assert";
import { EventEmitter } from "stream";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import logger from "./logger";
import { KnownDecentralizedStorageFetchers, MonitorConfig } from "./types";
import { Logger } from "winston";
import PendingContract from "./PendingContract";

function createsContract(tx: TransactionResponse): boolean {
  return !tx.to;
}

const NEW_BLOCK_EVENT = "new-block";

/**
 * A monitor that periodically checks for new contracts on a single chain.
 */
export class ChainMonitor extends EventEmitter {
  private sourcifyChain: SourcifyChain;
  private sourceFetchers: KnownDecentralizedStorageFetchers;
  private sourcifyServerURLs: string[];

  private chainLogger: Logger;
  private startBlock?: number;
  private blockInterval: number;
  private blockIntervalFactor: number;
  private blockIntervalUpperLimit: number;
  private blockIntervalLowerLimit: number;
  private bytecodeInterval: number;
  private bytecodeNumberOfTries: number;

  constructor(
    sourcifyChain: SourcifyChain,
    sourceFetchers: KnownDecentralizedStorageFetchers,
    monitorConfig: MonitorConfig
  ) {
    super();
    this.sourcifyChain = sourcifyChain;
    this.sourceFetchers = sourceFetchers; // TODO: handle multipe
    this.chainLogger = logger.child({
      prefix: "Chain #" + this.sourcifyChain.chainId,
    });

    this.chainLogger.info(
      `Initializing chain monitor for chain with sourceFetchers: ${Object.keys(
        sourceFetchers
      ).join(",")}`
    );
    this.sourcifyServerURLs = monitorConfig.sourcifyServerURLs;

    const chainConfig = {
      ...monitorConfig.defaultChainConfig,
      ...(monitorConfig.chainConfigs?.[this.sourcifyChain.chainId] || {}),
    };

    this.startBlock = chainConfig.startBlock;
    this.bytecodeInterval = chainConfig.bytecodeInterval;
    this.blockInterval = chainConfig.blockInterval;
    this.blockIntervalFactor = chainConfig.blockIntervalFactor;
    assert(this.blockIntervalFactor > 1);
    this.blockIntervalUpperLimit = chainConfig.blockIntervalUpperLimit;
    this.blockIntervalLowerLimit = chainConfig.blockIntervalLowerLimit;
    this.bytecodeNumberOfTries = chainConfig.bytecodeNumberOfTries;
  }

  start = async (): Promise<void> => {
    try {
      const lastBlockNumber = await this.sourcifyChain.getBlockNumber();
      const startBlock =
        this.startBlock !== undefined ? this.startBlock : lastBlockNumber;

      this.chainLogger.info(`Starting monitor on block ${startBlock}`);

      // Start polling
      this.pollBlocks(startBlock);

      // Listen to new blocks
      this.on(NEW_BLOCK_EVENT, this.processBlockListener);
    } catch (err: any) {
      this.chainLogger.error(`Error starting monitor: ${err.message}`);
    }
  };

  /**
   * Stops the monitor after executing all pending requests.
   */
  stop = (): void => {
    this.chainLogger.info(`Stopping monitor`);
    this.off(NEW_BLOCK_EVENT, this.processBlockListener);
  };

  // Tries to get the next block by polling in variable intervals.
  // If the block is fetched, emits a creation event, decreases the pause between blocks, and goes to next block
  // If the block isn't there yet, it increases the pause between blocks.
  // It should eventually converge to the expected block interval of the chain.
  private pollBlocks = async (startBlockNumber: number) => {
    let currentBlockNumber = startBlockNumber;
    const pollNextBlock = async () => {
      try {
        this.chainLogger.debug(
          `Polling for block ${currentBlockNumber} with pause ${this.blockInterval}...`
        );
        const block = await this.sourcifyChain.getBlock(
          currentBlockNumber,
          true
        );

        if (block) {
          this.adaptBlockPause("decrease");
          currentBlockNumber++;
          this.emit(NEW_BLOCK_EVENT, block);
        } else {
          this.adaptBlockPause("increase");
        }

        // Continue polling
        setTimeout(pollNextBlock, this.blockInterval);
      } catch (error: any) {
        this.chainLogger.error(
          `Error fetching block ${currentBlockNumber}: ${error?.message}`
        );
        this.adaptBlockPause("increase");
        // Continue polling
        setTimeout(pollNextBlock, this.blockInterval);
      }
    };

    pollNextBlock();
  };

  // ListenerFunction
  private processBlockListener = async (block: Block) => {
    this.chainLogger.info(`Found block ${block.number}. Now processing`);

    for (const tx of block.prefetchedTransactions) {
      // TODO: Check factory contracts with traces
      if (createsContract(tx)) {
        const address = getCreateAddress(tx);
        this.chainLogger.info(
          `Found new contract in block ${block.number} with address ${address} created by tx ${tx.hash}`
        );
        this.processNewContract(tx.hash, address);
      }
    }
  };

  private adaptBlockPause = (operation: "increase" | "decrease") => {
    const factor =
      operation === "increase"
        ? this.blockIntervalFactor
        : 1 / this.blockIntervalFactor;
    this.blockInterval *= factor;
    this.blockInterval = Math.min(
      this.blockInterval,
      this.blockIntervalUpperLimit
    );
    this.blockInterval = Math.max(
      this.blockInterval,
      this.blockIntervalLowerLimit
    );
    this.chainLogger.info(
      `${operation.toUpperCase()} block pause. New blockPause is ${
        this.blockInterval
      }`
    );
  };

  private async fetchBytecode(address: string): Promise<string | null> {
    try {
      const bytecode = await this.sourcifyChain.getBytecode(address);
      if (bytecode === "0x") {
        this.chainLogger.debug(`Bytecode is 0x for contract ${address}`);
        return null;
      }
      this.chainLogger.debug(`Bytecode found for contract ${address}`);
      return bytecode;
    } catch (err: any) {
      this.chainLogger.error(
        `Error fetching bytecode for contract ${address}: ${err.message}`
      );
      return null;
    }
  }

  private async getBytecodeWithRetries(address: string) {
    for (let i = this.bytecodeNumberOfTries; i > 0; i--) {
      const bytecode = await this.fetchBytecode(address);

      if (bytecode !== null) {
        return bytecode;
      }

      this.chainLogger.debug(
        `Retries left ${i - 1} for contract ${address}. Retrying in ${
          this.bytecodeInterval
        }ms...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, this.bytecodeInterval)
      );
    }

    return null;
  }

  // Function triggered when a new contract is found in a block.
  // Gets the contract bytecode, decodes the metadata hash, assembles the contract's files from DecentralizedStorage, and sends them to Sourcify servers.
  private processNewContract = async (
    creatorTxHash: string,
    address: string
  ) => {
    try {
      const bytecode = await this.getBytecodeWithRetries(address);
      if (!bytecode) {
        this.chainLogger.warn(
          `Could not fetch bytecode for contract ${address} or the contract's code is 0x. Skipping`
        );
        return;
      }
      const cborData = bytecodeDecode(bytecode);
      let metadataHash: FileHash;
      try {
        metadataHash = FileHash.fromCborData(cborData);
      } catch (err: any) {
        this.chainLogger.info(
          `Error getting the metadatahash for ${address}: ${err.message}`
        );
        return;
      }

      if (this.sourceFetchers[metadataHash.origin] === undefined) {
        this.chainLogger.info(
          `No source fetcher found for origin ${metadataHash.origin}. Skipping contract ${address}`
        );
        return;
      }

      const pendingContract = new PendingContract(
        metadataHash,
        address,
        this.sourcifyChain.chainId,
        this.sourceFetchers
      );
      this.chainLogger.debug(
        `New pending contract ${address} with hash ${metadataHash.getSourceHash()}`
      );
      try {
        await pendingContract.assemble();
      } catch (err: any) {
        this.chainLogger.info(`Couldn't assemble the contract ${address}`);
        this.chainLogger.info(err);
        return;
      }
      if (!isEmpty(pendingContract.pendingSources)) {
        logger.warn(
          `Could not fetch all sources for contract ${
            pendingContract.address
          } on ${pendingContract.chainId}. Sources missing: ${Object.keys(
            pendingContract.pendingSources
          ).join(",")}
            `
        );
        return;
      }

      this.chainLogger.debug(`Contract successfully ${address} assembled.`);

      this.sourcifyServerURLs.forEach(async (url) => {
        try {
          await pendingContract.sendToSourcifyServer(url, creatorTxHash);
        } catch (err: any) {
          this.chainLogger.error(
            `Error sending contract ${address} to Sourcify server ${url}: ${err.message}`
          );
        }
      });
    } catch (err: any) {
      this.chainLogger.error(
        `Error processing bytecode for contract ${address}: ${err}`
      );
    }
  };
}

function isEmpty(obj: object): boolean {
  return !Object.keys(obj).length && obj.constructor === Object;
}
