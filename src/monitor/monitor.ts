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
 * Interface for CallFrame objects.
 *
 * A CallFrame object is used to encapsulate information about a function call in the EVM,
 * including information about any sub-calls that are made.
 *
 * For more details on how these properties are used, see the official Ethereum documentation:
 * https://geth.ethereum.org/docs/developers/evm-tracing/built-in-tracers#call-tracer
 *
 * @interface
 * @property {string} type - CALL or CREATE
 * @property {string} from - address
 * @property {string} to - address
 * @property {string} value - hex-encoded amount of value transfer
 * @property {string} gas - hex-encoded gas provided for call
 * @property {string} gasUsed - hex-encoded gas used during call
 * @property {string} input - call data
 * @property {string} output - return data
 * @property {string} error - error, if any
 * @property {string} revertReason - Solidity revert reason, if any
 * @property {CallFrame[]} calls - list of sub-calls
 */
interface CallFrame {
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  error: string;
  revertReason: string;
  calls: CallFrame[];
}

/**
 * Recursive function to find and accumulate 'CREATE' and 'CREATE2' CallFrames in an array.
 *
 * This function checks if a provided CallFrame is of type 'CREATE' or 'CREATE2' and if so,
 * adds it to the results array. If not, and the CallFrame has sub-calls, it will check each
 * sub-call in the same manner.
 *
 * @param {CallFrame} call - The CallFrame to check.
 * @param {CallFrame[]} results - The array to accumulate 'CREATE' and 'CREATE2' CallFrames.
 */
function findCreateInDebugTraceTransactionCallFrame(
  call: CallFrame,
  results: CallFrame[]
) {
  if (call?.type === "CREATE" || call?.type === "CREATE2") {
    results.push(call);
  } else if (call?.calls?.length > 0) {
    call.calls.forEach((subCall) => {
      findCreateInDebugTraceTransactionCallFrame(subCall, results);
    });
  }
}

/**
 * Interface for TraceAction objects.
 *
 * TraceAction object encapsulates information about a transaction or internal call made
 * during the execution of a transaction.
 *
 * @interface
 * @property {string} from - The address of the sender.
 * @property {string} callType - The type of method such as call, delegatecall.
 * @property {string} gas - The gas provided by the sender, encoded as hexadecimal.
 * @property {string} input - The data sent along with the transaction.
 * @property {string} to - The address of the receiver.
 * @property {string} value - The integer of the value sent with this transaction, encoded as hexadecimal.
 */
interface TraceAction {
  from: string;
  callType: string;
  gas: string;
  input: string;
  to: string;
  value: string;
}

/**
 * Interface for Trace objects.
 *
 * Trace object includes information about a single transaction as well as the
 * associated block information and the result of the transaction execution.
 *
 * @interface
 * @property {TraceAction} action - An object encapsulating information about the transaction or internal call.
 * @property {string} blockHash - The hash of the block where this transaction was in.
 * @property {string} blockNumber - The block number where this transaction was in.
 * @property {{ [index: string]: string; }} result - An object with the total used gas by all transactions in this block and the output of the contract call.
 * @property {string} subtraces - The traces of contract calls made by the transaction.
 * @property {string} traceAddress - The list of addresses where the call was executed, the address of the parents, and the order of the current sub call.
 * @property {string} transactionHash - The hash of the transaction.
 * @property {string} transactionPosition - The position of the transaction in the block.
 * @property {string} type - The value of the method such as call or create.
 */
interface Trace {
  action: TraceAction;
  blockHash: string;
  blockNumber: string;
  result: {
    gasUsed: string;
    [index: string]: string;
  };
  subtraces: string;
  traceAddress: string;
  transactionHash: string;
  transactionPosition: string;
  type: string;
}

/**
 * Function to filter 'create' transactions from an array of Trace objects.
 *
 * This function checks each Trace object in the provided array and returns
 * a new array containing only those with a type of 'create'.
 *
 * @param {Trace[]} traces - An array of Trace objects to filter.
 * @returns {Trace[]} A new array of Trace objects of type 'create'.
 */
function findCreateInTraceTransaction(traces: Trace[]) {
  return traces.filter((trace) => trace.type === "create");
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
          } else {
            // This is the version using debug_traces
            /* this.sourcifyChain.providers[0]
              .send("debug_traceTransaction", [tx.hash, { tracer: "callTracer" }])
              .then((res: CallFrame) => {
                const result: CallFrame[] = [];
                findCreateInDebugTraceTransactionCallFrame(res, result);
                if (result.length > 0) {
                  result.forEach((call) => {
                    const address = call.to;
                    SourcifyEventManager.trigger("Monitor.NewContract", {
                      address,
                      chainId: this.sourcifyChain.chainId.toString(),
                    });
                    this.processBytecode(
                      tx.hash,
                      address,
                      this.initialGetBytecodeTries
                    );
                  });
                }
              }); */

            // This is the version using trace_transaction
            this.sourcifyChain.providers[1]
              .send("trace_transaction", [tx.hash])
              .then((res: Trace[]) => {
                const traces = findCreateInTraceTransaction(res);
                if (traces.length > 0) {
                  traces.forEach((trace) => {
                    const address = trace.result.address;
                    SourcifyEventManager.trigger("Monitor.NewContract", {
                      address,
                      chainId: this.sourcifyChain.chainId.toString(),
                    });
                    this.processBytecode(
                      tx.hash,
                      address,
                      this.initialGetBytecodeTries
                    );
                  });
                }
              });
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
