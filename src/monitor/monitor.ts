/* eslint-disable */
import Web3 from 'web3';
import { ethers } from 'ethers';
import request from 'request-promise-native';
import concat from 'it-concat';
import { outputFileSync } from 'fs-extra';
import * as bunyan from 'bunyan';
import { Injector } from '@ethereum-sourcify/verification';
import config from '../config';
import { BlockTransactionObject } from 'web3-eth';
import {
  MonitorConfig,
  ChainSet,
  CustomChainConfig,
  Queue,
  QueueItem,
  StringToBooleanMap,
  InputData,
  getChainByName,
  cborDecode,
  Logger,
  getSupportedChains,
  PathBuffer
} from '@ethereum-sourcify/core';
import { ValidationService } from '@ethereum-sourcify/validation';

const multihashes = require('multihashes');
const save = outputFileSync;

export default class Monitor {
  private log: bunyan;
  private chains: ChainSet;
  private ipfsCatRequest: string;
  private ipfsProvider: any;
  private swarmGateway: string;
  private repository: string;
  private blockTime: number;
  private blockInterval: any;
  private sourceInterval: any;
  private metadataInterval: any;
  private injector: Injector;
  private validationService: ValidationService;

  /**
   * Constructor
   *
   * @param {MonitorConfig = {}} monitorConfig [description]
   */
  constructor(monitorConfig: MonitorConfig = {}) {
    this.chains = {};

    this.ipfsCatRequest = monitorConfig.ipfsCatRequest || 'https://ipfs.infura.io:5001/api/v0/cat?arg=';
    this.ipfsProvider = monitorConfig.ipfsProvider || null;
    this.swarmGateway = 'https://swarm-gateways.net/';
    this.repository = monitorConfig.repository || 'repository';
    this.blockTime = monitorConfig.blockTime || 15 // seconds;

    this.blockInterval = null;
    this.sourceInterval = null;
    this.metadataInterval = null;

    this.log = Logger("Monitor");
    this.validationService = new ValidationService(this.log);

    Injector.createAsync({
      offline: true,
      log: this.log,
      infuraPID: config.endpoint.infuraId || "changeinfuraid",
      repositoryPath: config.repository.path
    }).then((injector: Injector) => this.injector = injector); // TODO temporary solution to enable compilation; await not allowed inside a constructor
  }

  /**
   * Starts running the monitor, listening to public eth chains via Infura for new contract
   * deployments and inserting them in a queue that periodically queries decentralized storage
   * providers like IPFS to retrieve metadata stored at the hash embedded in a contract's deployed
   * bytecode. Can be configured to listen to a single custom network (like localhost) for testing.
   *
   * @param  {CustomChainConfig} customChain
   * @return {Promise<void>}
   */
  public async start(customChain?: CustomChainConfig): Promise<void> {
    for (const chain of getSupportedChains()) {
      const url: string = customChain
        ? customChain.url
        : chain.web3[0].replace("${INFURA_ID}", process.env.INFURA_ID);
      
      this.chains[chain.name] = {
        web3: new Web3(url),
        metadataQueue: {},
        sourceQueue: {},
        latestBlock: 0,
        chainId: chain.chainId.toString()
      };

      const blockNumber = await this.chains[chain.name].web3.eth.getBlockNumber();
      this.chains[chain.name].latestBlock = blockNumber;

      this.log.info(
        {
          loc: '[START]',
          chain: chain,
          block: blockNumber
        },
        'Starting monitor for chain'
      );
    }

    this.blockInterval = setInterval(this.retrieveBlocks.bind(this), 1000 * this.blockTime);
    this.metadataInterval = setInterval(this.retrieveMetadata.bind(this), 1000 * this.blockTime);
    this.sourceInterval = setInterval(this.retrieveSource.bind(this), 1000 * this.blockTime);
  }

  /**
   * Shuts down the monitor
   */
  public stop(): void {
    this.log.info({ loc: '[STOP]' }, 'Stopping monitor')
    clearInterval(this.blockInterval);
    clearInterval(this.metadataInterval);
    clearInterval(this.sourceInterval);
  }

  /**
   * Wraps the ipfs.cat command. `cat` can be run with in-memory ipfs
   * provider or by a gateway url, per monitor config
   *
   * @param  {string}          hash [description]
   * @return {Promise<string>}      [description]
   */
  private async ipfsCat(hash: string): Promise<string> {
    return (this.ipfsProvider)
      ? (await concat(this.ipfsProvider.cat(`/ipfs/${hash}`))).slice().toString() // TODO the point of slice? copying? return await should be avoided
      : request(`${this.ipfsCatRequest}${hash}`);
  }

  // =======
  // Queue
  // =======

  /**
   * Adds item to a string indexed set the monitor will periodically iterate over,
   * seeking to match contract deployments and their associated metadata / source components.
   * Each item is timestamped so it can be removed when stale.
   *
   * @param {StringMap} queue string indexed set
   * @param {string}    key   index
   * @param {QueueItem} item
   */
  private addToQueue(queue: Queue, key: string, item: QueueItem): void {
    if (queue[key] !== undefined)
      return;
    item.timestamp = new Date().getTime();
    queue[key] = item;
  }

  /**
   * Deletes items from a queue that have gone stale
   *
   * @param {StringMap} queue        string indexed set
   * @param {number}    maxAgeInSecs staleness criterion
   */
  private cleanupQueue(queue: Queue, maxAgeInSecs: number): void {
    const toDelete: StringToBooleanMap = {};

    // getTime
    for (const key in queue) {
      // tslint:disable-next-line: no-useless-cast
      const currentTimeMillis = new Date().getTime();
      if ((queue[key].timestamp as number + (maxAgeInSecs * 1000)) < currentTimeMillis) {
        toDelete[key] = true;
      }
    }
    for (const key in toDelete) {
      delete queue[key]
    }
  }

  // =======
  // Blocks
  // =======

  /**
   * Retrieves blocks for all chains
   */
  private retrieveBlocks(): void {
    try {
      for (const chain in this.chains) {
        this.retrieveBlocksInChain(chain);
      }
    } catch (err) {
      this.log.info(
        {
          loc: '[ERROR]',
          err: err
        },
        'Block retreival error'
      );
    }
  }

  /**
   * Polls chain for new blocks, detecting contract deployments and
   * calling `retrieveBytecode` when one is discovered
   *
   * @param {string} chain [description]
   */
  private retrieveBlocksInChain(chain: string): void {
    const _this = this;
    const web3 = this.chains[chain].web3;

    web3.eth.getBlockNumber((err: Error, newBlockNr: number) => {
      if (err) return;
      // tslint:disable restrict-plus-operands
      newBlockNr = Math.min(newBlockNr, _this.chains[chain].latestBlock + 4);

      for (; _this.chains[chain].latestBlock < newBlockNr; _this.chains[chain].latestBlock++) {
        const latest = _this.chains[chain].latestBlock;

        web3.eth.getBlock(latest, true, (err: Error, block: BlockTransactionObject) => {
          if (err || !block) {
            const latest = _this.chains[chain].latestBlock;

            this.log.info(
              {
                loc: '[BLOCKS]',
                chain: chain,
                block: latest,
                err: err
              },
              'Block not available'
            );

            return;
          }

          this.log.info(
            {
              loc: '[BLOCKS]',
              chain: chain,
              block: block.number
            },
            'Processing Block'
          );

          for (const i in block.transactions) {
            const t = block.transactions[i]
            if (t.to === null) {
              const address = ethers.utils.getContractAddress(t);

              this.log.info(
                {
                  loc: '[BLOCKS]',
                  chain: chain,
                  block: block.number,
                  address: address
                },
                `Retrieving code for address`
              );

              _this.retrieveCode(chain, address);
            }
          }
        })
      }
    })
  }

  /**
   * Fetches on-chain deployed bytecode and extracts its metadata hash. Add the item to
   * a metadata queue which will periodically query decentralized storage to discover whether
   * metadata exists at the discovered metadata hash address.
   *
   * @param {string} chain   ex: 'ropsten'
   * @param {string} address contract address
   */
  private retrieveCode(chain: string, address: string): void {
    const _this = this;
    const web3 = this.chains[chain].web3;

    this.log.info({loc: "[BLOCKS]", chain, address}, "Retrieving code");

    web3.eth.getCode(address, (err: Error, bytecode: string) => {
      if (err) {
        this.log.error({loc: "[BLOCKS]", chain, address}, "Cannot retrieve code");
        return;
      }

      try {
        const cborData = cborDecode(web3.utils.hexToBytes(bytecode))

        if (!cborData) {

        }

        let option;
        let metadata;

        if ("bzzr1" in cborData) {
          option = "bzzr1";
          metadata = web3.utils.bytesToHex(cborData['bzzr1']).slice(2);
        } else if ("ipfs" in cborData) {
          option = "ipfs";
          metadata = multihashes.toB58String(cborData['ipfs']);
        } else {
          this.log.warn({loc: "[BLOCKS]", chain, address}, "Could not find a compatible metadata extraction method");
          return;
        }

        const infoObject: any = {loc: "[BLOCKS]", chain, address};
        infoObject[option] = option;
        this.log.info(infoObject, "Queueing retrieval of metadata");

        const queueItem: any = {bytecode};
        queueItem[option] = metadata;

        _this.addToQueue(
          _this.chains[chain].metadataQueue,
          address,
          queueItem
        );

      } catch (error) {
        this.log.error({loc: "[BLOCKS]", chain, address}, "Error in metadata extraction.");
      }
    })
  }

  // =========
  // Metadata
  // =========

  /**
   * Retrieves metadata by chain. This data may be in decentralized storage - its storage
   * address has been queued after a contract deployment was detected by the retrieveBlocks
   * engine.
   */
  private retrieveMetadata(): void {
    try {
      for (const chain in this.chains) {
        this.retrieveMetadataInChain(chain);
      }
    } catch (err) {
      this.log.info(
        {
          loc: '[ERROR]',
          err: err
        },
        'Metadata retreival error'
      );
    }
  }

  /**
   * Retrieves metadata from decentralized storage provider
   * for chain after deleting stale metadata queue items.
   * @param {string} chain ex: 'ropsten'
   */
  private retrieveMetadataInChain(chain: string): void {
    /// Try to retrieve metadata for one hour
    this.cleanupQueue(this.chains[chain].metadataQueue, 3600)
    for (const address in this.chains[chain].metadataQueue) {
      this.log.info(
        {
          loc: '[METADATA]',
          chain: chain,
          address: address
        },
        'Processing metadata queue'
      );

      // tslint:disable-next-line:no-floating-promises
      this.retrieveMetadataByStorageProvider(
        chain,
        address,
        this.chains[chain].metadataQueue[address].bytecode,
        this.chains[chain].metadataQueue[address]['bzzr1'],
        this.chains[chain].metadataQueue[address]['ipfs']
      );
    }
  }

  /**
   * Queries decentralized storage for metadata at the location specified by
   * hash embedded in the bytecode of a deployed contract. If metadata is discovered,
   * its sources are added to a source discovery queue. (Supports swarm:bzzr1 and ipfs)
   *
   * @param  {string}        chain         ex: 'ropsten'
   * @param  {string}        address       contract address
   * @param  {string}        metadataBzzr1 storage hash
   * @param  {string}        metadataIpfs  storage hash
   * @return {Promise<void>}
   */
  private async retrieveMetadataByStorageProvider(
    chain: string,
    address: string,
    bytecode: string | undefined,
    metadataBzzr1: string | undefined,
    metadataIpfs: string | undefined
  ): Promise<void> {
    let metadataRaw;

    const found: any = {
      files: {},
      bytecode: bytecode
    };

    if (metadataBzzr1) {

      try {
        // TODO guard against too large files
        // TODO only write files after recompilation check?
        metadataRaw = await request(`${this.swarmGateway}/bzz-raw:/${metadataBzzr1}`);
        found.swarm = {
          metadataPath: `${this.repository}/swarm/bzzr1/${metadataBzzr1}`,
          file: metadataRaw
        }
      } catch (error) { return }

    } else if (metadataIpfs) {

      try {
        metadataRaw = await this.ipfsCat(metadataIpfs);
        found.ipfs = {
          metadataPath: `${this.repository}/ipfs/${metadataIpfs}`,
          file: metadataRaw.toString()
        }
      } catch (error) { return }
    }

    this.log.info(
      {
        loc: '[METADATA]',
        chain: chain,
        address: address
      },
      'Got metadata by address'
    );

    // found.files.push(metadataRaw.toString()) TODO this shouldn't be in the same array as solidity content

    const metadata = JSON.parse(metadataRaw);
    delete this.chains[chain].metadataQueue[address];

    try {
      this.addToQueue(this.chains[chain].sourceQueue, address, {
        metadataRaw: metadataRaw.toString(),
        sources: metadata.sources,
        found: found
      });
    } catch (error) {

    }
  }


  // =======
  // Sources
  // =======

  /**
   * Queries decentralized storage for solidity files at the location specified by
   * a metadata sources manifest.
   */
  private retrieveSource(): void {
    try {
      for (const chain in this.chains) {
        this.retrieveSourceInChain(chain);
      }
    } catch (err) {
      this.log.info(
        {
          loc: '[ERROR]',
          err: err
        },
        'Source retreival error'
      );
    }
  }

  /**
   * Retrieves solidity files by address from decentralized storage provider after
   * deleting stale source queue items.
   * @param {string} chain ex: 'ropsten'
   */
  private retrieveSourceInChain(chain: string): void {
    /// Try to retrieve source for five days.
    this.cleanupQueue(this.chains[chain].sourceQueue, 3600 * 24 * 5)

    for (const address in this.chains[chain].sourceQueue) {
      this.log.info(
        {
          loc: '[SOURCE]',
          chain: chain,
          address: address
        },
        'Processing source queue'
      );

      this.retrieveSourceByAddress(
        chain,
        address,
        this.chains[chain].sourceQueue[address].sources
      );
    }
  }

  /**
   * Retrieves solidity files *for* a contract address from decentralized storage provider.
   *
   * @param {string} chain ex: 'ropsten'
   * @param {string} chain   [description]
   * @param {string} address [description]
   * @param {any}    sources [description]
   */
  private retrieveSourceByAddress(
    chain: string,
    address: string,
    sources: any
  ): void {
    for (const sourceKey in sources) {
      for (const url of sources[sourceKey]['urls']) {

        // tslint:disable-next-line:no-floating-promises
        this.retrieveSwarmSource(chain, address, sourceKey, url);

        // tslint:disable-next-line:no-floating-promises
        this.retrieveIpfsSource(chain, address, sourceKey, url);
      }
    }
  }

  /**
   * Queries swarm for solidity file at metadata specified url and saves if found
   * @param  {string}        chain     ex: 'ropsten'
   * @param  {string}        address   contract address
   * @param  {string}        sourceKey file path or file name
   * @param  {string}        url       metadata specified swarm url
   * @return {Promise<void>}
   */
  private async retrieveSwarmSource(
    chain: string,
    address: string,
    sourceKey: string,
    url: string
  ): Promise<void> {
    if (!url.startsWith('bzz-raw')) return;

    try {
      const source = await request(`${this.swarmGateway}${url}`);

      // tslint:disable-next-line:no-floating-promises
      this.sourceFound(chain, address, sourceKey, source);

    } catch (error) {
      // ignore
    }
  }

  /**
   * Queries ipfs for solidity file at metadata specified url and saves if found.
   * @param  {string}        chain     ex: 'ropsten'
   * @param  {string}        address   contract address
   * @param  {string}        sourceKey file path or file name
   * @param  {string}        url       metadata specified ipfs url
   * @return {Promise<void>}
   */
  private async retrieveIpfsSource(
    chain: string,
    address: string,
    sourceKey: string,
    url: string
  ): Promise<void> {

    if (!url.startsWith('dweb')) return;

    try {
      const source = await this.ipfsCat(url.split('dweb:/ipfs/')[1]);

      // tslint:disable-next-line:no-floating-promises
      this.sourceFound(chain, address, sourceKey, source.toString());

    } catch (error) {
      // ignore
    }
  }

  /**
   * Writes discovered sources to repository under chain address and source key
   * qualified path:
   *
   * @example "repository/contract/ropsten/0xabc..defc/sources/Simple.sol"

   * @param {string} chain     ex: 'ropsten'
   * @param {string} address   contract address
   * @param {string} sourceKey file path or file name
   * @param {string} source    solidity file
   */
  private async sourceFound(
    chain: string,
    address: string,
    sourceKey: string,
    source: string
  ): Promise<void> {

    const queueItem = this.chains[chain].sourceQueue[address];
    if (queueItem && (sourceKey in queueItem.sources)) {
      queueItem.found.files[sourceKey] = source;
      delete queueItem.sources[sourceKey];
    } else {
      return;
    }

    const remaining = Object.keys(queueItem.sources);

    this.log.info(
      {
        loc: '[SOURCES]',
        chain: chain,
        address: address,
        sources: remaining
      },
      'Sources left to be retrieved'
    );

    // Once we've assembled all the sources, inject them.
    // Also save ipfs and swarm hashes.
    if (Object.keys(queueItem.sources).length == 0) {

      const inputFiles: PathBuffer[] = [];
      const metadataPathBuffer = { buffer: Buffer.from(queueItem.metadataRaw) }; // TODO is property metadataRaw really optional?
      inputFiles.push(metadataPathBuffer);
      for (const filePath in queueItem.found.files) {
        const fileContent = queueItem.found.files[filePath];
        const filePathBuffer = { buffer: Buffer.from(fileContent), path: filePath };
        inputFiles.push(filePathBuffer);
      }

      const data: InputData = {
        chain: getChainByName(chain).chainId.toString(),
        addresses: [address],
        bytecode: queueItem.found.bytecode
      };

      try {
        const validatedFiles = this.validationService.checkFiles(inputFiles);
        const errors = validatedFiles
                        .filter(contract => !contract.isValid())
                        .map(contract => contract.info);
        if (errors.length) {
          throw new Error(errors.join("\n"));
        }
        data.contracts = validatedFiles;

        await this.injector.inject(data);

        if (queueItem.found.swarm) {
          save(queueItem.found.swarm.metadataPath, queueItem.found.swarm.file)
        }

        if (queueItem.found.ipfs) {
          save(queueItem.found.ipfs.metadataPath, queueItem.found.ipfs.file)
        }
      } catch (err) {
        this.log.error({
          loc: "[SOURCES:INJECTION_FAILED]",
          chain,
          address
        }, err);
      }
      delete this.chains[chain].sourceQueue[address];
    }
  }
}
