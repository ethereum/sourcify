import { SourceAddress } from "./util";
import { TransactionResponse, getCreateAddress } from "ethers";
import SourceFetcher from "./source-fetcher";
import assert from "assert";
import { EventEmitter } from "stream";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import { SourcifyEventManager } from "../common/SourcifyEventManager/SourcifyEventManager";
import {
  CheckedContract,
  SourcifyChain,
} from "@ethereum-sourcify/lib-sourcify";
import { services } from "../server/services/services";
import { IRepositoryService } from "../server/services/RepositoryService";
import { IVerificationService } from "../server/services/VerificationService";
import { monitoredChainArray } from "../sourcify-chains";
import { logger } from "../common/loggerLoki";
import "../common/SourcifyEventManager/listeners/logger";

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
class ChainMonitor extends EventEmitter {
  private sourcifyChain: SourcifyChain;
  private sourceFetcher: SourceFetcher;
  private verificationService: IVerificationService;
  private repositoryService: IRepositoryService;
  private running: boolean;

  private getBytecodeRetryPause: number;
  private getBlockPause: number;
  private initialGetBytecodeTries: number;

  constructor(
    sourcifyChain: SourcifyChain,
    sourceFetcher: SourceFetcher,
    verificationService: IVerificationService,
    repositoryService: IRepositoryService
  ) {
    super();
    this.sourcifyChain = sourcifyChain;
    this.sourceFetcher = sourceFetcher;
    this.verificationService = verificationService;
    this.repositoryService = repositoryService;
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

      SourcifyEventManager.trigger("Monitor.Started", {
        chainId: this.sourcifyChain.chainId.toString(),
        lastBlockNumber,
        startBlock,
      });
      this.processBlock(startBlock);
    } catch (err) {
      SourcifyEventManager.trigger("Monitor.Error.CantStart", {
        chainId: this.sourcifyChain.chainId.toString(),
        message: "Couldn't find a working RPC node.",
      });
    }
  };

  /**
   * Stops the monitor after executing all pending requests.
   */
  stop = (): void => {
    SourcifyEventManager.trigger(
      "Monitor.Stopped",
      this.sourcifyChain.chainId.toString()
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

        SourcifyEventManager.trigger("Monitor.ProcessingBlock", {
          blockNumber,
          chainId: this.sourcifyChain.chainId.toString(),
          getBlockPause: this.getBlockPause,
        });

        for (const tx of block.prefetchedTransactions) {
          if (createsContract(tx)) {
            const address = getCreateAddress(tx);
            if (this.isVerified(address)) {
              SourcifyEventManager.trigger("Monitor.AlreadyVerified", {
                address,
                chainId: this.sourcifyChain.chainId.toString(),
              });
              this.emit(
                "contract-already-verified",
                this.sourcifyChain.chainId,
                address
              );
            } else {
              SourcifyEventManager.trigger("Monitor.NewContract", {
                address,
                chainId: this.sourcifyChain.chainId.toString(),
              });
              this.processBytecode(
                tx.hash,
                address,
                this.initialGetBytecodeTries
              );
            }
          }
        }

        blockNumber++;
      })
      .catch((err) => {
        SourcifyEventManager.trigger("Monitor.Error.ProcessingBlock", {
          message: err.message,
          stack: err.stack,
          chainId: this.sourcifyChain.chainId.toString(),
          blockNumber,
        });
      })
      .finally(() => {
        this.mySetTimeout(this.processBlock, this.getBlockPause, blockNumber);
      });
  };

  private isVerified(address: string): boolean {
    const foundArr = this.repositoryService.checkByChainAndAddress(
      address,
      this.sourcifyChain.chainId.toString()
    );
    return !!foundArr.length;
  }

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
              this.verifyAndStore(contract, address, creatorTxHash);
            }
          );
        } catch (err: any) {
          SourcifyEventManager.trigger("Monitor.Error.ProcessingBytecode", {
            message: err.message,
            stack: err.stack,
            chainId: this.sourcifyChain.chainId.toString(),
            address,
          });
        }
      })
      .catch((err) => {
        SourcifyEventManager.trigger("Monitor.Error.GettingBytecode", {
          message: err.message,
          stack: err.stack,
          chainId: this.sourcifyChain.chainId.toString(),
          address,
        });
        this.mySetTimeout(
          this.processBytecode,
          this.getBytecodeRetryPause,
          creatorTxHash,
          address,
          retriesLeft
        );
      });
  };

  private verifyAndStore = async (
    contract: CheckedContract,
    address: string,
    creatorTxHash: string
  ) => {
    try {
      const match = await this.verificationService.verifyDeployed(
        contract,
        this.sourcifyChain.chainId.toString(),
        address,
        /* undefined, */
        creatorTxHash
      );
      await this.repositoryService.storeMatch(contract, match);
      this.emit(
        "contract-verified-successfully",
        this.sourcifyChain.chainId,
        address
      );
    } catch (err: any) {
      SourcifyEventManager.trigger("Monitor.Error.VerifyError", {
        message: err.message,
        stack: err.stack,
        chainId: this.sourcifyChain.chainId.toString(),
        address,
      });
    }
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

/**
 * A monitor that periodically checks for new contracts on designated chains.
 */
export default class Monitor extends EventEmitter {
  private chainMonitors: ChainMonitor[];
  private sourceFetcher = new SourceFetcher();

  constructor(chainsToMonitor?: SourcifyChain[]) {
    super();
    chainsToMonitor = chainsToMonitor?.length
      ? chainsToMonitor
      : monitoredChainArray; // default to all monitored chains
    this.chainMonitors = chainsToMonitor.map(
      (sourcifyChain) =>
        new ChainMonitor(
          sourcifyChain,
          this.sourceFetcher,
          services.verification,
          services.repository
        )
    );
    this.chainMonitors.forEach((cm) => {
      cm.on("contract-verified-successfully", (chainId, address) => {
        this.emit("contract-verified-successfully", chainId, address);
      });
      cm.on("contract-already-verified", (chainId, address) => {
        this.emit("contract-already-verified", chainId, address);
      });
    });
  }

  /**
   * Starts the monitor on all the designated chains.
   */
  start = async (): Promise<void> => {
    const promises = [];
    for (const cm of this.chainMonitors) {
      promises.push(cm.start());
    }
    await Promise.all(promises);
  };

  /**
   * Stops the monitor after executing all the pending requests.
   */
  stop = (): void => {
    this.chainMonitors.forEach((cm) => cm.stop());
    this.sourceFetcher.stop();
  };
}

if (require.main === module) {
  const monitor = new Monitor();
  monitor.start();
}
