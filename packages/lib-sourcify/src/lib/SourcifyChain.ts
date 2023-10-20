import {
  FetchRequest,
  JsonRpcProvider,
  Network,
  TransactionReceipt,
  TransactionResponse,
  getAddress,
} from 'ethers';
import { Chain, SourcifyChainExtension } from './types';
import { logError, logInfo, logWarn } from './logger';

const RPC_TIMEOUT = process.env.RPC_TIMEOUT
  ? parseInt(process.env.RPC_TIMEOUT)
  : 10 * 1000;

// It is impossible to get the url from the Provider for logging purposes
interface JsonRpcProviderWithUrl extends JsonRpcProvider {
  url?: string;
}

// Need to define the rpc property explicitly as when a sourcifyChain is created with {...chain, sourcifyChainExtension}, Typescript throws with "Type '(string | FetchRequest)[]' is not assignable to type 'string[]'." For some reason the Chain.rpc is not getting overwritten by SourcifyChainExtension.rpc
export type SourcifyChainInstance = Omit<Chain, 'rpc'> &
  Omit<SourcifyChainExtension, 'rpc'> & { rpc: Array<string | FetchRequest> };

class CreatorTransactionMismatchError extends Error {
  constructor() {
    super("Creator transaction doesn't match the contract");
  }
}

export default class SourcifyChain {
  name: string;
  title?: string | undefined;
  chainId: number;
  rpc: Array<string | FetchRequest>;
  supported: boolean;
  contractFetchAddress?: string | undefined;
  graphQLFetchAddress?: string | undefined;
  txRegex?: string[] | undefined;
  providers: JsonRpcProviderWithUrl[];

  constructor(sourcifyChainObj: SourcifyChainInstance) {
    this.name = sourcifyChainObj.name;
    this.title = sourcifyChainObj.title;
    this.chainId = sourcifyChainObj.chainId;
    this.rpc = sourcifyChainObj.rpc;
    this.supported = sourcifyChainObj.supported;
    this.contractFetchAddress = sourcifyChainObj.contractFetchAddress;
    this.graphQLFetchAddress = sourcifyChainObj.graphQLFetchAddress;
    this.txRegex = sourcifyChainObj.txRegex;
    this.providers = [];

    if (!this.supported) return; // Don't create providers if chain is not supported

    if (!this?.rpc.length)
      throw new Error(
        'No RPC provider was given for this chain with id ' +
          this.chainId +
          ' and name ' +
          this.name
      );

    for (const rpc of this.rpc) {
      let provider: JsonRpcProviderWithUrl | undefined;
      const ethersNetwork = new Network(this.name, this.chainId);
      if (typeof rpc === 'string') {
        if (rpc.startsWith('http')) {
          // Use staticNetwork to avoid sending unnecessary eth_chainId requests
          provider = new JsonRpcProvider(rpc, ethersNetwork, {
            staticNetwork: ethersNetwork,
          });
          provider.url = rpc;
        } else {
          // Do not use WebSockets because of not being able to catch errors on websocket initialization. Most networks don't support WebSockets anyway. See https://github.com/ethers-io/ethers.js/discussions/2896
          // provider = new WebSocketProvider(rpc);
          logInfo(`Won't create a WebSocketProvider for ${rpc}`);
        }
      } else {
        provider = new JsonRpcProvider(rpc, ethersNetwork, {
          staticNetwork: ethersNetwork,
        });
        provider.url = rpc.url;
      }
      if (provider) {
        this.providers.push(provider);
      }
    }
  }

  rejectInMs = (ms: number, host?: string) =>
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`RPC ${host} took too long to respond`)),
        ms
      );
    });

  getTx = async (creatorTxHash: string) => {
    // Try sequentially all providers
    for (const provider of this.providers) {
      try {
        // Race the RPC call with a timeout
        const tx = await Promise.race([
          provider.getTransaction(creatorTxHash),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        if (tx instanceof TransactionResponse) {
          logInfo(
            `Transaction ${creatorTxHash} fetched via ${provider.url} from chain ${this.chainId}`
          );
          return tx;
        } else {
          throw new Error(
            `Transaction ${creatorTxHash} not found on RPC ${provider.url} and chain ${this.chainId}`
          );
        }
      } catch (err) {
        if (err instanceof Error) {
          logWarn(
            `Can't fetch the transaction ${creatorTxHash} from RPC ${provider.url} and chain ${this.chainId}\n ${err}`
          );
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new Error(
      'None of the RPCs responded fetching tx ' +
        creatorTxHash +
        ' on chain ' +
        this.chainId
    );
  };

  getTxReceipt = async (creatorTxHash: string) => {
    // Try sequentially all providers
    for (const provider of this.providers) {
      try {
        // Race the RPC call with a timeout
        const tx = await Promise.race([
          provider.getTransactionReceipt(creatorTxHash),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        if (tx instanceof TransactionReceipt) {
          logInfo(
            `Transaction's receipt ${creatorTxHash} fetched via ${provider.url} from chain ${this.chainId}`
          );
          return tx;
        } else {
          throw new Error(
            `Transaction's receipt ${creatorTxHash} not found on RPC ${provider.url} and chain ${this.chainId}`
          );
        }
      } catch (err) {
        if (err instanceof Error) {
          logWarn(
            `Can't fetch the transaction's receipt ${creatorTxHash} from RPC ${provider.url} and chain ${this.chainId}\n ${err}`
          );
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new Error(
      'None of the RPCs responded fetching tx ' +
        creatorTxHash +
        ' on chain ' +
        this.chainId
    );
  };

  getTxTraces = async (creatorTxHash: string) => {
    // Try sequentially all providers
    for (const provider of this.providers) {
      try {
        // Race the RPC call with a timeout
        const traces = await Promise.race([
          provider.send('trace_transaction', [creatorTxHash]),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        if (traces instanceof Array && traces.length > 0) {
          logInfo(
            `Transaction's traces of ${creatorTxHash} fetched via ${provider.url} from chain ${this.chainId}`
          );
          return traces;
        } else {
          throw new Error(
            `Transaction's traces of ${creatorTxHash} on RPC ${provider.url} and chain ${this.chainId} received empty or malformed response`
          );
        }
      } catch (err) {
        if (err instanceof Error) {
          logWarn(
            `Can't fetch the transaction's traces of ${creatorTxHash} from RPC ${provider.url} and chain ${this.chainId}\n ${err}`
          );
          continue;
        } else {
          throw err;
        }
      }
    }

    throw new Error(
      'None of the RPCs responded fetching tx ' +
        creatorTxHash +
        ' on chain ' +
        this.chainId
    );
  };

  /**
   * Fetches the contract's deployed bytecode from SourcifyChain's rpc's.
   * Tries to fetch sequentially if the first RPC is a local eth node. Fetches in parallel otherwise.
   *
   * @param {SourcifyChain} sourcifyChain - chain object with rpc's
   * @param {string} address - contract address
   */
  getBytecode = async (address: string): Promise<string> => {
    address = getAddress(address);

    // Request sequentially. Custom node is always before ALCHEMY so we don't waste resources if succeeds.
    for (const provider of this.providers) {
      try {
        // Race the RPC call with a timeout
        const bytecode = await Promise.race([
          provider.getCode(address),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        logInfo(
          'Bytecode fetched from ' +
            provider.url +
            ' for ' +
            address +
            ' on chain ' +
            this.chainId
        );
        return bytecode;
      } catch (err) {
        if (err instanceof Error) {
          logWarn(
            `Can't fetch ${address}'s bytecode from RPC ${provider.url} and chain ${this.chainId}`
          );
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new Error(
      'None of the RPCs responded fetching bytecode for ' +
        address +
        ' on chain ' +
        this.chainId
    );
  };

  getBlock = async (blockNumber: number, preFetchTxs = true) => {
    // Request sequentially. Custom node is always before ALCHEMY so we don't waste resources if succeeds.
    for (const provider of this.providers) {
      try {
        // Race the RPC call with a timeout
        const block = await Promise.race([
          provider.getBlock(blockNumber, preFetchTxs),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        if (block) {
          logInfo(
            `Block ${blockNumber} fetched from ${provider.url} on chain ${this.chainId}`
          );
        } else {
          logInfo(
            `Block ${blockNumber} not published yet on ${this.chainId} from ${provider.url}`
          );
        }
        return block;
      } catch (err: any) {
        logWarn(
          `Can't fetch block ${blockNumber} from RPC ${provider.url} and chain ${this.chainId}, error: ${err.message}`
        );
        continue;
      }
    }
    logError(
      `None of the RPCs responded fetching block ${blockNumber} on chain ${this.chainId}`
    );
    throw new Error(
      'None of the RPCs responded fetching block ' +
        blockNumber +
        ' on chain ' +
        this.chainId
    );
  };

  getBlockNumber = async () => {
    // Request sequentially. Custom node is always before ALCHEMY so we don't waste resources if succeeds.
    for (const provider of this.providers) {
      try {
        // Race the RPC call with a timeout
        const block = await Promise.race([
          provider.getBlockNumber(),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        logInfo(
          'Block number fetched from ' +
            provider.url +
            ' on chain ' +
            this.chainId
        );
        return block;
      } catch (err) {
        if (err instanceof Error) {
          logWarn(
            `Can't fetch the current block number from RPC ${provider.url} and chain ${this.chainId}`
          );
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new Error(
      'None of the RPCs responded fetching the blocknumber on chain ' +
        this.chainId
    );
  };

  getContractCreationBytecode = async (
    address: string,
    transactionHash: string
  ): Promise<string> => {
    const txReceipt = await this.getTxReceipt(transactionHash);
    const tx = await this.getTx(transactionHash);
    let creationBytecode = '';

    // Non null txreceipt.contractAddress means that the contract was created with an EOA
    if (txReceipt.contractAddress !== null) {
      if (txReceipt.contractAddress !== address) {
        throw new CreatorTransactionMismatchError();
      }
      creationBytecode = tx.data;
    } else {
      // Factory created
      let traces;
      try {
        traces = await this.getTxTraces(transactionHash);
      } catch (e: any) {
        logInfo(e.message);
        traces = [];
      }

      // If traces are available check, otherwise lets just trust
      if (traces.length > 0) {
        const createTraces = traces.filter(
          (trace: any) => trace.type === 'create'
        );
        const createdContractAddressesInTx = createTraces.find(
          (trace) => getAddress(trace.result.address) === address
        );
        if (createdContractAddressesInTx === undefined) {
          throw new CreatorTransactionMismatchError();
        }
        creationBytecode = createdContractAddressesInTx.result.code;
      }
    }

    return creationBytecode;
  };
}
