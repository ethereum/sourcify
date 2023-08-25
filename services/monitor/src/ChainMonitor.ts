import { SourceAddress } from "./util";
import { TransactionResponse, getCreateAddress } from "ethers";
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
import { log } from "console";

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

/**
 * A monitor that periodically checks for new contracts on a single chain.
 */
export class ChainMonitor extends EventEmitter {
  private sourcifyChain: SourcifyChain;
  private sourceFetcher: SourceFetcher;
  private running: boolean;

  private getBytecodeRetryPause: number;
  private getBlockPause: number;
  private initialGetBytecodeTries: number;

  constructor(
    sourcifyChain: SourcifyChain,
    sourceFetchers: KnownSourceFetchers,
    sourcifyServerURLs: string[]
  ) {
    super();
    this.sourcifyChain = sourcifyChain;
    this.sourceFetcher = sourceFetchers.ipfs; // TODO: handle multipe
    this.running = false;

    this.getBytecodeRetryPause =
      parseInt(process.env.GET_BYTECODE_RETRY_PAUSE || "") || 5 * 1000;
    this.getBlockPause =
      parseInt(process.env.GET_BLOCK_PAUSE || "") || 10 * 1000;
    this.initialGetBytecodeTries =
      parseInt(process.env.INITIAL_GET_BYTECODE_TRIES || "") || 3;
  }

  start = async (): Promise<void> => {
    this.running = true;
    const rawStartBlock =
      process.env[`MONITOR_START_${this.sourcifyChain.chainId}`];

    try {
      const lastBlockNumber = await this.sourcifyChain.getBlockNumber();
      const startBlock =
        rawStartBlock !== undefined ? parseInt(rawStartBlock) : lastBlockNumber;

      logger.info(
        `Starting monitor for chain ${this.sourcifyChain.chainId.toString()}`
      );

      this.processBlock(startBlock);
    } catch (err: any) {
      logger.error(
        `Error starting monitor for chain ${this.sourcifyChain.chainId.toString()}: ${
          err.message
        }`
      );
    }
  };

  /**
   * Stops the monitor after executing all pending requests.
   */
  stop = (): void => {
    logger.info(
      `Stopping monitor for chain ${this.sourcifyChain.chainId.toString()}`
    );
    this.running = false;
  };

  private processBlock = (blockNumber: number) => {
    this.sourcifyChain
      .getBlock(blockNumber, true)
      .then((block) => {
        if (!block) {
          this.adaptBlockPause("increase");
          return;
        }

        this.adaptBlockPause("decrease");

        logger.info(
          `Processing block ${blockNumber} on chain ${this.sourcifyChain.chainId.toString()}`
        );

        for (const tx of block.prefetchedTransactions) {
          if (createsContract(tx)) {
            const address = getCreateAddress(tx);
            logger.info(
              `New contract ${address} created on chain ${this.sourcifyChain.chainId.toString()}`
            );
            this.processBytecode(
              tx.hash,
              address,
              this.initialGetBytecodeTries
            );
          }
        }

        blockNumber++;
      })
      .catch((err) => {
        logger.error(
          `Error fetching block ${blockNumber} on chain ${this.sourcifyChain.chainId.toString()}: ${
            err.message
          }`
        );
      })
      .finally(() => {
        this.mySetTimeout(this.processBlock, this.getBlockPause, blockNumber);
      });
  };

  private adaptBlockPause = (operation: "increase" | "decrease") => {
    const factor =
      operation === "increase" ? BLOCK_PAUSE_FACTOR : 1 / BLOCK_PAUSE_FACTOR;
    this.getBlockPause *= factor;
    this.getBlockPause = Math.min(this.getBlockPause, BLOCK_PAUSE_UPPER_LIMIT);
    this.getBlockPause = Math.max(this.getBlockPause, BLOCK_PAUSE_LOWER_LIMIT);
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
              logger.info(
                `Now sending the contract ${contract.name} to Sourcify server`
              );
            }
          );
        } catch (err: any) {
          logger.error(
            `Error processing bytecode for contract ${address} on chain ${this.sourcifyChain.chainId.toString()}: ${
              err.message
            }`
          );
        }
      })
      .catch((err) => {
        logger.error(
          `Error fetching bytecode for contract ${address} on chain ${this.sourcifyChain.chainId.toString()}: ${
            err.message
          }`
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
