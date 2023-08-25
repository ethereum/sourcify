import { SourceAddress } from "./util";
import { Block, TransactionResponse, getCreateAddress } from "ethers";
import SourceFetcher from "./source-fetcher";
import assert from "assert";
import { EventEmitter } from "stream";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import {
  CheckedContract,
  SourcifyChain,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "./logger";
import { KnownSourceFetchers } from "./types";
import { Logger } from "winston";

const BLOCK_PAUSE_FACTOR =
  parseInt(process.env.BLOCK_PAUSE_FACTOR || "") || 1.1;
assert(BLOCK_PAUSE_FACTOR > 1);
const BLOCK_PAUSE_UPPER_LIMIT =
  parseInt(process.env.BLOCK_PAUSE_UPPER_LIMIT || "") || 30 * 1000; // default: 30 seconds
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
  private sourceFetcher: SourceFetcher;
  private sourcifyServerURLs: string[];
  private running: boolean;

  private chainLogger: Logger;
  private getBytecodeRetryPause: number;
  private blockPause: number;
  private initialGetBytecodeTries: number;

  constructor(
    sourcifyChain: SourcifyChain,
    sourceFetchers: KnownSourceFetchers,
    sourcifyServerURLs: string[]
  ) {
    super();
    this.sourcifyChain = sourcifyChain;
    this.sourceFetcher = sourceFetchers.ipfs; // TODO: handle multipe
    this.sourcifyServerURLs = sourcifyServerURLs;
    this.running = false;

    this.getBytecodeRetryPause =
      parseInt(process.env.GET_BYTECODE_RETRY_PAUSE || "") || 5 * 1000;
    this.blockPause = parseInt(process.env.GET_BLOCK_PAUSE || "") || 10 * 1000;
    this.initialGetBytecodeTries =
      parseInt(process.env.INITIAL_GET_BYTECODE_TRIES || "") || 3;

    this.chainLogger = logger.child({
      chainId: this.sourcifyChain.chainId.toString(),
    });
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
  // If it succeeds, emits a creation event, decreases the pause between blocks, and goes to next block
  // If it fails, it increases the pause between blocks.
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
        this.processBytecode(tx.hash, address, this.initialGetBytecodeTries);
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

  private processBytecode = (
    creatorTxHash: string,
    address: string,
    retriesLeft: number
  ): void => {
    if (retriesLeft-- <= 0) {
      return;
    }

    this.sourcifyChain
      .getBytecode(address)
      .then((bytecode) => {
        if (bytecode === "0x") {
          this.mySetTimeout(
            this.processBytecode,
            this.getBytecodeRetryPause,
            creatorTxHash,
            address,
            retriesLeft
          );
          return;
        }

        try {
          const cborData = bytecodeDecode(bytecode);
          const metadataAddress = SourceAddress.fromCborData(cborData);
          this.sourceFetcher.assemble(
            metadataAddress,
            (contract: CheckedContract) => {
              // TODO: send to Sourcify server
              this.chainLogger.info(
                `Now sending the contract ${contract.name} to Sourcify server`
              );
            }
          );
        } catch (err: any) {
          this.chainLogger.error(
            `Error processing bytecode for contract ${address}: ${err.message}`
          );
        }
      })
      .catch((err) => {
        this.chainLogger.error(
          `Error fetching bytecode for contract ${address}: ${err.message}`
        );
        this.mySetTimeout(
          this.processBytecode,
          this.getBytecodeRetryPause,
          creatorTxHash,
          address,
          retriesLeft
        );
      });
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
}
