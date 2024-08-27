import {
  FetchRequest,
  JsonRpcProvider,
  Network,
  TransactionReceipt,
  TransactionResponse,
  getAddress,
} from 'ethers';
import {
  Chain,
  FetchContractCreationTxMethods,
  SourcifyChainExtension,
} from './types';
import { logDebug, logError, logInfo, logWarn } from './logger';

const RPC_TIMEOUT = process.env.RPC_TIMEOUT
  ? parseInt(process.env.RPC_TIMEOUT)
  : 10 * 1000;

// It is impossible to get the url from the Provider for logging purposes
interface JsonRpcProviderWithUrl extends JsonRpcProvider {
  url?: string;
}

// Need to define the rpc property explicitly as when a sourcifyChain is created with {...chain, sourcifyChainExtension}, Typescript throws with "Type '(string | FetchRequest)[]' is not assignable to type 'string[]'." For some reason the Chain.rpc is not getting overwritten by SourcifyChainExtension.rpc
// Also omit the 'sourcifyName' as it is only needed to have the name in sourcify-chains.json but not when instantiating a SourcifyChain
export type SourcifyChainInstance = Omit<Chain, 'rpc'> &
  Omit<SourcifyChainExtension, 'rpc' | 'sourcifyName'> & {
    rpc: Array<string | FetchRequest>;
  };

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
  providers: JsonRpcProviderWithUrl[];
  fetchContractCreationTxUsing?: FetchContractCreationTxMethods;
  etherscanApi?: {
    apiURL: string;
    apiKeyEnvName?: string;
  };

  constructor(sourcifyChainObj: SourcifyChainInstance) {
    this.name = sourcifyChainObj.name;
    this.title = sourcifyChainObj.title;
    this.chainId = sourcifyChainObj.chainId;
    this.rpc = sourcifyChainObj.rpc;
    this.supported = sourcifyChainObj.supported;
    this.providers = [];
    this.fetchContractCreationTxUsing =
      sourcifyChainObj.fetchContractCreationTxUsing;
    this.etherscanApi = sourcifyChainObj.etherscanApi;

    if (!this.supported) return; // Don't create providers if chain is not supported

    if (!this?.rpc.length)
      throw new Error(
        'No RPC provider was given for this chain with id ' +
          this.chainId +
          ' and name ' +
          this.name,
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
          logDebug("Won't create a WebSocketProvider", { rpc });
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
        ms,
      );
    });

  getTx = async (creatorTxHash: string) => {
    // Try sequentially all providers
    for (const provider of this.providers) {
      try {
        logInfo('Fetching tx', {
          creatorTxHash,
          providerUrl: provider.url,
        });
        // Race the RPC call with a timeout
        const tx = await Promise.race([
          provider.getTransaction(creatorTxHash),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        if (tx instanceof TransactionResponse) {
          logInfo('Fetched tx', { creatorTxHash, providerUrl: provider.url });
          return tx;
        } else {
          throw new Error(
            `Transaction ${creatorTxHash} not found on RPC ${provider.url} and chain ${this.chainId}`,
          );
        }
      } catch (err) {
        if (err instanceof Error) {
          logWarn('Failed to fetch tx', {
            creatorTxHash,
            providerUrl: provider.url,
            chainId: this.chainId,
            error: err.message,
          });
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
        this.chainId,
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
          logInfo('Fetched tx receipt', {
            creatorTxHash,
            providerUrl: provider.url,
            chainId: this.chainId,
          });
          return tx;
        } else {
          throw new Error(
            `Transaction's receipt ${creatorTxHash} not found on RPC ${provider.url} and chain ${this.chainId}`,
          );
        }
      } catch (err) {
        if (err instanceof Error) {
          logWarn('Failed to fetch tx receipt', {
            creatorTxHash,
            providerUrl: provider.url,
            chainId: this.chainId,
            error: err.message,
          });
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
        this.chainId,
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
          logInfo('Fetched tx traces', {
            creatorTxHash,
            providerUrl: provider.url,
            chainId: this.chainId,
          });
          return traces;
        } else {
          throw new Error(
            `Transaction's traces of ${creatorTxHash} on RPC ${provider.url} and chain ${this.chainId} received empty or malformed response`,
          );
        }
      } catch (err) {
        if (err instanceof Error) {
          logWarn('Failed to fetch tx traces', {
            creatorTxHash,
            providerUrl: provider.url,
            chainId: this.chainId,
            error: err.message,
          });
          continue;
        } else {
          throw err;
        }
      }
    }

    throw new Error(
      'None of the RPCs could successfully fetch tx traces for ' +
        creatorTxHash +
        ' on chain ' +
        this.chainId,
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
    let currentProviderIndex = 0;
    for (const provider of this.providers) {
      currentProviderIndex++;
      try {
        logDebug('Fetching bytecode', {
          address,
          providerUrl: provider.url,
          chainId: this.chainId,
          currentProviderIndex,
          providersLength: this.providers.length,
        });
        // Race the RPC call with a timeout
        const bytecode = await Promise.race([
          provider.getCode(address),
          this.rejectInMs(RPC_TIMEOUT, provider.url),
        ]);
        logInfo('Fetched bytecode', {
          address,
          providerUrl: provider.url,
          chainId: this.chainId,
        });
        return bytecode;
      } catch (err) {
        if (err instanceof Error) {
          logWarn('Failed to fetch bytecode', {
            address,
            providerUrl: provider.url,
            chainId: this.chainId,
            error: err.message,
          });
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
        this.chainId,
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
          logInfo('Fetched block', {
            blockNumber,
            providerUrl: provider.url,
            chainId: this.chainId,
          });
        } else {
          logInfo('Block not published yet', {
            blockNumber,
            providerUrl: provider.url,
            chainId: this.chainId,
          });
        }
        return block;
      } catch (err: any) {
        logWarn('Failed to fetch the block', {
          blockNumber,
          providerUrl: provider.url,
          chainId: this.chainId,
          error: err.message,
        });
        continue;
      }
    }
    logError('None of the RPCs responded for fetching block', {
      blockNumber,
      providers: this.providers.map((p) => p.url),
      chainId: this.chainId,
    });
    throw new Error(
      'None of the RPCs responded fetching block ' +
        blockNumber +
        ' on chain ' +
        this.chainId,
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
        logInfo('Fetched eth_blockNumber', {
          blockNumber: block,
          providerUrl: provider.url,
          chainId: this.chainId,
        });
        return block;
      } catch (err) {
        if (err instanceof Error) {
          logWarn('Failed to fetch eth_blockNumber', {
            providerUrl: provider.url,
            chainId: this.chainId,
            error: err.message,
          });
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new Error(
      'None of the RPCs responded fetching the blocknumber on chain ' +
        this.chainId,
    );
  };

  getContractCreationBytecodeAndReceipt = async (
    address: string,
    transactionHash: string,
    creatorTx?: TransactionResponse,
  ): Promise<{
    creationBytecode: string;
    txReceipt: TransactionReceipt;
  }> => {
    const txReceipt = await this.getTxReceipt(transactionHash);
    if (!creatorTx) creatorTx = await this.getTx(transactionHash);

    let creationBytecode;
    // Non null txreceipt.contractAddress means that the contract was created with an EOA
    if (txReceipt.contractAddress !== null) {
      if (txReceipt.contractAddress !== address) {
        throw new CreatorTransactionMismatchError();
      }
      creationBytecode = creatorTx.data;
      logDebug(`Contract ${address} created with an EOA`);
    } else {
      // Factory created
      let traces;
      logDebug(`Contract ${address} created with a factory. Fetching traces`);
      try {
        traces = await this.getTxTraces(transactionHash);
      } catch (e: any) {
        logInfo(e.message);
        traces = [];
      }

      // If traces are available check, otherwise lets just trust
      if (traces.length > 0) {
        const createTraces = traces.filter(
          (trace: any) => trace.type === 'create',
        );
        const createdContractAddressesInTx = createTraces.find(
          (trace) => getAddress(trace.result.address) === address,
        );
        if (createdContractAddressesInTx === undefined) {
          throw new CreatorTransactionMismatchError();
        }
        logDebug('Found contract bytecode in traces', {
          address,
          transactionHash,
          chainId: this.chainId,
        });
        creationBytecode = createdContractAddressesInTx.result.code;
      }
    }

    if (!creationBytecode) {
      throw new Error(
        `Cannot get the creation bytecode for ${address} from the transaction hash ${transactionHash} on chain ${this.chainId}`,
      );
    }

    return {
      creationBytecode,
      txReceipt,
    };
  };
}
