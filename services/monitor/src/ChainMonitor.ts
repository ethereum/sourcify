import { FileHash } from "./util";
import { Block, TransactionResponse, getCreateAddress } from "ethers";
import assert from "assert";
import { EventEmitter } from "stream";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import logger from "./logger";
import { KnownDecentralizedStorageFetchers, MonitorConfig } from "./types";
import PendingContract from "./PendingContract";
import { Logger } from "winston";

function createsContract(tx: TransactionResponse): boolean {
  return !tx.to;
}

const NEW_BLOCK_EVENT = "new-block";

/**
 * A monitor that periodically checks for new contracts on a single chain.
 */
export default class ChainMonitor extends EventEmitter {
  public sourcifyChain: SourcifyChain;
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
  private running = false;

  constructor(
    sourcifyChain: SourcifyChain,
    sourceFetchers: KnownDecentralizedStorageFetchers,
    monitorConfig: MonitorConfig,
  ) {
    super();
    this.sourcifyChain = sourcifyChain;
    this.sourceFetchers = sourceFetchers; // TODO: handle multipe
    this.chainLogger = logger.child({
      moduleName: "ChainMonitor #" + this.sourcifyChain.chainId,
    });

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
    this.chainLogger.info(
      "Created ChainMonitor",
      Object.fromEntries(
        Object.entries(this).filter(([, v]) => typeof v !== "function"), // print everything except functions
      ),
    );
  }

  start = async (): Promise<void> => {
    this.chainLogger.info("Starting ChainMonitor");
    try {
      if (this.running) {
        this.chainLogger.warn("ChainMonitor already running");
        return;
      }
      this.running = true;
      if (this.startBlock === undefined) {
        this.chainLogger.info(
          "No start block provided. Starting from last block",
        );
        this.startBlock = await this.sourcifyChain.getBlockNumber();
      }

      this.chainLogger.info("Starting polling", { block: this.startBlock });

      // Start polling
      this.pollBlocks(this.startBlock);

      // Listen to new blocks
      this.on(NEW_BLOCK_EVENT, this.processBlockListener);
    } catch (err: any) {
      this.chainLogger.error("Error starting ChainMonitor", { err });
    }
  };

  /**
   * Stops the monitor after executing all pending requests.
   */
  stop = (): void => {
    this.chainLogger.info("Stopping ChainMonitor", { ...this });
    this.running = false;
    this.off(NEW_BLOCK_EVENT, this.processBlockListener);
  };

  // Tries to get the next block by polling in variable intervals.
  // If the block is fetched, emits a creation event, decreases the pause between blocks, and goes to next block
  // If the block isn't there yet, it increases the pause between blocks.
  // It should eventually converge to the expected block interval of the chain.
  private pollBlocks = async (startBlockNumber: number) => {
    let currentBlockNumber = startBlockNumber;
    const pollNextBlock = async () => {
      if (!this.running) {
        return;
      }
      try {
        this.chainLogger.debug("Polling block", {
          currentBlockNumber,
          interval: this.blockInterval,
        });
        const block = await this.sourcifyChain.getBlock(
          currentBlockNumber,
          true,
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
        this.chainLogger.error("Error fetching block", {
          currentBlockNumber,
          error,
        });
        this.adaptBlockPause("increase");
        // Continue polling
        setTimeout(pollNextBlock, this.blockInterval);
      }
    };

    pollNextBlock();
  };

  // ListenerFunction
  private processBlockListener = async (block: Block) => {
    this.chainLogger.info("Found and processing block", {
      blockNumber: block.number,
    });
    this.chainLogger.silly("Block", block);

    for (const tx of block.prefetchedTransactions) {
      // TODO: Check factory contracts with traces
      this.chainLogger.silly("Checking tx", {
        txHash: tx.hash,
        blockNumber: block.number,
      });
      this.chainLogger.silly("Tx", tx);
      if (createsContract(tx)) {
        const address = getCreateAddress(tx);
        this.chainLogger.info("Found new contract in block", {
          blockNumber: block.number,
          address,
          txHash: tx.hash,
        });
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
      this.blockIntervalUpperLimit,
    );
    this.blockInterval = Math.max(
      this.blockInterval,
      this.blockIntervalLowerLimit,
    );
    this.chainLogger.info(`${operation.toUpperCase()} block pause.`, {
      blockInterval: this.blockInterval,
    });
  };

  private async fetchBytecode(address: string): Promise<string | null> {
    try {
      const bytecode = await this.sourcifyChain.getBytecode(address);
      if (bytecode === "0x") {
        this.chainLogger.debug("Bytecode is 0x", { address });
        return null;
      }
      this.chainLogger.debug("Fetched bytecode", { address });
      return bytecode;
    } catch (err: any) {
      this.chainLogger.error("Error fetching bytecode", { address, err });
      return null;
    }
  }

  private async getBytecodeWithRetries(address: string) {
    for (let i = this.bytecodeNumberOfTries; i > 0; i--) {
      this.chainLogger.debug("Fetching bytecode", {
        retryNumber: this.bytecodeNumberOfTries - i + 1,
        address,
        bytecodeInterval: this.bytecodeInterval,
        maxRetries: this.bytecodeNumberOfTries,
      });

      const bytecode = await this.fetchBytecode(address);

      if (bytecode !== null) {
        return bytecode;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.bytecodeInterval),
      );
    }

    this.chainLogger.debug("No retries left for fetching bytecode", {
      address,
    });
    return null;
  }

  // Function triggered when a new contract is found in a block.
  // Gets the contract bytecode, decodes the metadata hash, assembles the contract's files from DecentralizedStorage, and sends them to Sourcify servers.
  private processNewContract = async (
    creatorTxHash: string,
    address: string,
  ) => {
    try {
      const bytecode = await this.getBytecodeWithRetries(address);
      if (!bytecode) {
        this.chainLogger.warn("Could not fetch bytecode for contract", {
          address,
        });
        return;
      }
      const cborData = bytecodeDecode(bytecode);
      let metadataHash: FileHash;
      try {
        metadataHash = FileHash.fromCborData(cborData);
      } catch (err: any) {
        this.chainLogger.info("Error getting metadatahash", { address, err });
        return;
      }

      if (this.sourceFetchers[metadataHash.origin] === undefined) {
        this.chainLogger.info("No source fetcher found", {
          address,
          origin: metadataHash.origin,
        });
        return;
      }

      const pendingContract = new PendingContract(
        metadataHash,
        address,
        this.sourcifyChain.chainId,
        this.sourceFetchers,
      );
      this.chainLogger.debug("New pending contract", { address, metadataHash });
      try {
        await pendingContract.assemble();
      } catch (err: any) {
        this.chainLogger.info("Couldn't assemble contract", { address, err });
        return;
      }
      if (!isEmpty(pendingContract.pendingSources)) {
        logger.warn("PendingSources not empty", {
          address: pendingContract.address,
          pendingSources: pendingContract.pendingSources,
        });
        return;
      }

      this.chainLogger.info("Contract assembled", { address, metadataHash });
      this.chainLogger.silly("Contract assembled", {
        pendingContract,
      });

      this.sourcifyServerURLs.forEach(async (url) => {
        try {
          await pendingContract.sendToSourcifyServer(url, creatorTxHash);
        } catch (err: any) {
          this.chainLogger.error("Error sending contract to Sourcify server", {
            url,
            err,
            address,
          });
        }
      });
    } catch (err: any) {
      this.chainLogger.error("Error processing bytecode", { address, err });
    }
  };
}

function isEmpty(obj: object): boolean {
  return !Object.keys(obj).length && obj.constructor === Object;
}
