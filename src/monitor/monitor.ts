import { SourceAddress } from "./util";
import {
  JsonRpcProvider,
  Provider,
  TransactionResponse,
  WebSocketProvider,
  getCreateAddress,
} from "ethers";
import SourceFetcher from "./source-fetcher";
import assert from "assert";
import { EventEmitter } from "stream";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import { SourcifyEventManager } from "../common/SourcifyEventManager/SourcifyEventManager";
import {
  Chain,
  CheckedContract,
  Match,
  matchWithDeployedBytecode,
  addLibraryAddresses,
  verifyDeployed,
} from "@ethereum-sourcify/lib-sourcify";
import { services } from "../server/services/services";
import { IRepositoryService } from "../server/services/RepositoryService";
import { IVerificationService } from "../server/services/VerificationService";
import {
  monitoredChainArray,
  supportedChainsMap,
  LOCAL_CHAINS,
} from "../sourcify-chains";
import { logger } from "../common/loggerLoki";
import "../common/SourcifyEventManager/listeners/logger";

const BLOCK_PAUSE_FACTOR =
  parseInt(process.env.BLOCK_PAUSE_FACTOR || "") || 1.1;
assert(BLOCK_PAUSE_FACTOR > 1);
const BLOCK_PAUSE_UPPER_LIMIT =
  parseInt(process.env.BLOCK_PAUSE_UPPER_LIMIT || "") || 30 * 1000; // default: 30 seconds
const BLOCK_PAUSE_LOWER_LIMIT =
  parseInt(process.env.BLOCK_PAUSE_LOWER_LIMIT || "") || 0.5 * 1000; // default: 0.5 seconds
const PROVIDER_TIMEOUT = parseInt(process.env.PROVIDER_TIMEOUT || "") || 3000;

function createsContract(tx: TransactionResponse): boolean {
  return !tx.to;
}

/**
 * A monitor that periodically checks for new contracts on a single chain.
 */
class ChainMonitor extends EventEmitter {
  private chainId: string;
  private providerURLs: string[];
  private provider: Provider | undefined;
  private sourceFetcher: SourceFetcher;
  private verificationService: IVerificationService;
  private repositoryService: IRepositoryService;
  private running: boolean;

  private getBytecodeRetryPause: number;
  private getBlockPause: number;
  private initialGetBytecodeTries: number;

  constructor(
    name: string,
    chainId: string,
    providerURLs: string[],
    sourceFetcher: SourceFetcher,
    verificationService: IVerificationService,
    repositoryService: IRepositoryService
  ) {
    super();
    this.chainId = chainId;
    this.providerURLs = providerURLs;
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
    const rawStartBlock = process.env[`MONITOR_START_${this.chainId}`];

    // iterate over RPCs to find a working one; log the search result
    let found = false;
    for (const providerURL of this.providerURLs) {
      // const opts = { timeout: PROVIDER_TIMEOUT };
      // TODO: ethers provider does not support timeout https://github.com/ethers-io/ethers.js/issues/4122
      const provider = providerURL.startsWith("http")
        ? // prettier vs. eslint indentation conflict here
          /* eslint-disable indent*/
          new JsonRpcProvider(providerURL, {
            chainId: parseInt(this.chainId),
          })
        : new WebSocketProvider(providerURL, {
            chainId: parseInt(this.chainId),
          });
      /* eslint-enable indent*/
      try {
        const lastBlockNumber = await provider.getBlockNumber();
        found = true;

        this.provider = provider;

        const startBlock =
          rawStartBlock !== undefined
            ? parseInt(rawStartBlock)
            : lastBlockNumber;

        SourcifyEventManager.trigger("Monitor.Started", {
          chainId: this.chainId,
          providerURL,
          lastBlockNumber,
          startBlock,
        });
        this.processBlock(startBlock);
        break;
      } catch (err) {
        logger.info(`${providerURL} did not work: \n ${err}`);
      }
    }

    if (!found) {
      SourcifyEventManager.trigger("Monitor.Error.CantStart", {
        chainId: this.chainId,
        message: "Couldn't find a working RPC node.",
      });
    }
  };

  /**
   * Stops the monitor after executing all pending requests.
   */
  stop = (): void => {
    SourcifyEventManager.trigger("Monitor.Stopped", this.chainId);
    this.running = false;
  };

  private processBlock = (blockNumber: number) => {
    if (!this.provider)
      throw new Error(
        `Can't process block ${blockNumber}. Provider not initialized`
      );

    this.provider
      .getBlock(blockNumber, true)
      .then((block) => {
        if (!block) {
          this.adaptBlockPause("increase");
          return;
        }

        this.adaptBlockPause("decrease");

        SourcifyEventManager.trigger("Monitor.ProcessingBlock", {
          blockNumber,
          chainId: this.chainId,
          getBlockPause: this.getBlockPause,
        });

        for (const tx of block.prefetchedTransactions) {
          if (createsContract(tx)) {
            const address = getCreateAddress(tx);
            if (this.isVerified(address)) {
              SourcifyEventManager.trigger("Monitor.AlreadyVerified", {
                address,
                chainId: this.chainId,
              });
              this.emit("contract-already-verified", this.chainId, address);
            } else {
              SourcifyEventManager.trigger("Monitor.NewContract", {
                address,
                chainId: this.chainId,
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
          chainId: this.chainId,
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
      this.chainId
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
    if (!this.provider)
      throw new Error(`Can't process bytecode. Provider not initialized`);

    this.provider
      .getCode(address)
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
            chainId: this.chainId,
            address,
          });
        }
      })
      .catch((err) => {
        SourcifyEventManager.trigger("Monitor.Error.GettingBytecode", {
          message: err.message,
          stack: err.stack,
          chainId: this.chainId,
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
        this.chainId,
        address,
        /* undefined, */
        creatorTxHash
      );
      await this.repositoryService.storeMatch(contract, match);
      this.emit("contract-verified-successfully", this.chainId, address);
    } catch (err: any) {
      SourcifyEventManager.trigger("Monitor.Error.VerifyError", {
        message: err.message,
        stack: err.stack,
        chainId: this.chainId,
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
export interface MonitorConfig {
  testing?: boolean;
}

/**
 * A monitor that periodically checks for new contracts on designated chains.
 */
export default class Monitor extends EventEmitter {
  private chainMonitors: ChainMonitor[];
  private sourceFetcher = new SourceFetcher();

  constructor(config: MonitorConfig = {}) {
    super();
    const chains = config.testing ? LOCAL_CHAINS : monitoredChainArray;
    this.chainMonitors = chains.map(
      (chain: Chain) =>
        new ChainMonitor(
          chain.name,
          chain.chainId.toString(),
          chain.rpc,
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
