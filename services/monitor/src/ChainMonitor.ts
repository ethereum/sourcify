import { FileHash } from "./util";
import { Block, TransactionResponse, getCreateAddress } from "ethers";
import assert from "assert";
import { EventEmitter } from "stream";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import logger from "./logger";
import { KnownDecentralizedStorageFetchers } from "./types";
import { Logger } from "winston";
import PendingContract from "./PendingContract";

const BLOCK_PAUSE_FACTOR =
  parseInt(process.env.BLOCK_PAUSE_FACTOR || "") || 1.1;
assert(BLOCK_PAUSE_FACTOR > 1);
const BLOCK_PAUSE_UPPER_LIMIT =
  parseInt(process.env.BLOCK_PAUSE_UPPER_LIMIT || "") || 300 * 1000; // default: 300 seconds
const BLOCK_PAUSE_LOWER_LIMIT =
  parseInt(process.env.BLOCK_PAUSE_LOWER_LIMIT || "") || 0.5 * 1000; // default: 0.5 seconds

function createsContract(tx: TransactionResponse): boolean {
  return !tx.to;
}

const EVENT_CONTRACT_CREATED = "contractCreated";

/**
 * A monitor that periodically checks for new contracts on a single chain.
 */
export class ChainMonitor extends EventEmitter {
  private sourcifyChain: SourcifyChain;
  private sourceFetchers: KnownDecentralizedStorageFetchers;
  private sourcifyServerURLs: string[];
  private running: boolean;

  private chainLogger: Logger;
  private getBytecodeRetryPause: number;
  private blockPause: number;
  private initialGetBytecodeTries: number;
  private initialBlockTries: number;

  constructor(
    sourcifyChain: SourcifyChain,
    sourceFetchers: KnownDecentralizedStorageFetchers,
    sourcifyServerURLs: string[]
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
    this.sourcifyServerURLs = sourcifyServerURLs;
    this.running = false;

    this.getBytecodeRetryPause =
      parseInt(process.env.GET_BYTECODE_RETRY_PAUSE || "") || 5 * 1000;
    this.blockPause = parseInt(process.env.GET_BLOCK_PAUSE || "") || 10 * 1000;
    this.initialGetBytecodeTries =
      parseInt(process.env.INITIAL_GET_BYTECODE_TRIES || "") || 3;
    this.initialBlockTries =
      parseInt(process.env.INITIAL_BLOCK_TRIES || "") || 3;
  }

  start = async (): Promise<void> => {
    this.running = true;
    const rawStartBlock =
      process.env[`MONITOR_START_${this.sourcifyChain.chainId}`];

    try {
      const lastBlockNumber = await this.sourcifyChain.getBlockNumber();
      const startBlock =
        rawStartBlock !== undefined ? parseInt(rawStartBlock) : lastBlockNumber;

      this.chainLogger.info(`Starting monitor`);

      // Start polling
      this.pollBlocks(startBlock);

      // Listen to creations
      this.on(EVENT_CONTRACT_CREATED, this.processBlockListener);
    } catch (err: any) {
      this.chainLogger.error(`Error starting monitor: ${err.message}`);
    }
  };

  /**
   * Stops the monitor after executing all pending requests.
   */
  stop = (): void => {
    this.chainLogger.info(`Stopping monitor`);
    this.off(EVENT_CONTRACT_CREATED, this.processBlockListener);
    this.running = false;
  };

  // Tries to get the next block by polling in variable intervals.
  // If the block is fetched, emits a creation event, decreases the pause between blocks, and goes to next block
  // If the block isn't there yet, it increases the pause between blocks.
  private pollBlocks = async (startBlockNumber: number) => {
    let currentBlockNumber = startBlockNumber;
    const pollNextBlock = async () => {
      try {
        this.chainLogger.debug(
          `Polling for block ${currentBlockNumber} with pause ${this.blockPause}...`
        );
        const block = await this.sourcifyChain.getBlock(
          currentBlockNumber,
          true
        );

        if (block) {
          this.adaptBlockPause("decrease");
          currentBlockNumber++;
          this.emit(EVENT_CONTRACT_CREATED, block);
        } else {
          this.adaptBlockPause("increase");
        }

        // Continue polling
        setTimeout(pollNextBlock, this.blockPause);
      } catch (error: any) {
        this.chainLogger.error(
          `Error fetching block ${currentBlockNumber}: ${error?.message}`
        );
        this.adaptBlockPause("increase");
        // Continue polling
        setTimeout(pollNextBlock, this.blockPause);
      }
    };

    pollNextBlock();
  };

  // ListenerFunction
  private processBlockListener = async (block: Block) => {
    this.chainLogger.info(`Found block ${block.number}. Now processing`);

    for (const tx of block.prefetchedTransactions) {
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
      operation === "increase" ? BLOCK_PAUSE_FACTOR : 1 / BLOCK_PAUSE_FACTOR;
    this.blockPause *= factor;
    this.blockPause = Math.min(this.blockPause, BLOCK_PAUSE_UPPER_LIMIT);
    this.blockPause = Math.max(this.blockPause, BLOCK_PAUSE_LOWER_LIMIT);
    this.chainLogger.info(
      `${operation.toUpperCase()} block pause. New blockPause is ${
        this.blockPause
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

  private async getBytecodeWithRetries(address: string): Promise<string> {
    for (let i = this.initialGetBytecodeTries; i > 0; i--) {
      const bytecode = await this.fetchBytecode(address);

      if (bytecode !== null) {
        return bytecode;
      }

      this.chainLogger.debug(
        `Retries left ${i - 1}. Retrying in ${this.getBytecodeRetryPause}ms...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, this.getBytecodeRetryPause)
      );
    }

    throw new Error(`Maximum retries reached for ${address}`);
  }

  private processNewContract = async (
    creatorTxHash: string,
    address: string
  ) => {
    try {
      const bytecode = await this.getBytecodeWithRetries(address);
      const cborData = bytecodeDecode(bytecode);
      const metadataHash = FileHash.fromCborData(cborData);

      const pendingContract = new PendingContract(
        metadataHash,
        this.sourceFetchers
      );
      this.chainLogger.debug(
        `New pending contract ${address} with hash ${metadataHash.getSourceHash()}`
      );
      await pendingContract.assemble();

      // TODO: send to Sourcify server
      this.chainLogger.info(`Now sending the contract to Sourcify server`);
    } catch (err: any) {
      this.chainLogger.error(
        `Error processing bytecode for contract ${address}: ${err}`
      );
    }
  };
}
