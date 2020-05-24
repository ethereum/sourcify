import Web3 from 'web3';
import { ethers } from 'ethers';
import request from  'request-promise-native';
import { outputFileSync } from 'fs-extra';

import { cborDecode, getChainByName, InputData } from './utils';
import Injector from './injector';
import { BlockTransactionObject } from 'web3-eth';
import Logger from 'bunyan';

const multihashes = require('multihashes');
const save = outputFileSync;

export interface MonitorConfig {
  ipfsCatRequest? : string,
  ipfsProvider? : any,
  swarmGateway? : string,
  repository? : string,
  blockTime? : number,
  silent?: boolean
}

export interface CustomChainConfig {
  name: string,
  url: string
}

declare interface ChainSet {
  [key: string]: ChainData
}

declare interface ChainData {
  web3 : Web3,
  metadataQueue: Queue,
  sourceQueue: Queue,
  latestBlock : number,
  chainId: string
}

declare interface Queue {
  [key: string]: QueueItem;
}

declare interface QueueItem {
  bzzr1? : string,
  ipfs? : string,
  timestamp? : number,
  metadataRaw? : string,
  sources?: any,
  found?: any,
  bytecode?: string
}

declare interface StringToBooleanMap {
  [key: string]: boolean;
}

export default class Monitor {
  private log: Logger;
  private chains : ChainSet;
  private ipfsCatRequest: string;
  private ipfsProvider: any;
  private swarmGateway: string;
  private repository: string;
  private blockTime: number;
  private blockInterval: any;
  private sourceInterval: any;
  private metadataInterval: any;
  private injector: Injector;

  /**
   * Constructor
   *
   * @param {MonitorConfig = {}} config [description]
   */
  constructor(config: MonitorConfig = {}) {
    this.chains = {};

    this.ipfsCatRequest = config.ipfsCatRequest || 'https://ipfs.infura.io:5001/api/v0/cat?arg=';
    this.ipfsProvider = config.ipfsProvider || null;
    this.swarmGateway = 'https://swarm-gateways.net/';
    this.repository = config.repository || 'repository';
    this.blockTime = config.blockTime || 15 // seconds;

    this.blockInterval = null;
    this.sourceInterval = null;
    this.metadataInterval = null;

    this.log = Logger.createLogger({
      name: "Monitor",
      streams: [{
        stream: process.stdout,
        level: config.silent ? 'fatal' : 30
      }]
    });

    this.injector = new Injector({
      offline: true,
      log: this.log
    });
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
  public async start(customChain? : CustomChainConfig) : Promise<void> {
    const chainNames: string[] = customChain
      ? [customChain.name]
      : ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli'];

    for (const chain of chainNames){
      const options = getChainByName(chain)
      const url : string = customChain
        ? customChain.url
        : options.web3[0];

      this.chains[chain] = {
        web3: new Web3(url),
        metadataQueue: {},
        sourceQueue: {},
        latestBlock: 0,
        chainId: options.chainId.toString()
      };

      const blockNumber = await this.chains[chain].web3.eth.getBlockNumber();
      this.chains[chain].latestBlock = blockNumber;

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
  public stop() : void {
    this.log.info({loc: '[STOP]'}, 'Stopping monitor')
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
  private async ipfsCat(hash: string) : Promise<string> {
    return (this.ipfsProvider)
      ? this.ipfsProvider.cat(`/ipfs/${hash}`)
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
  private addToQueue(queue: Queue, key:string, item: QueueItem) : void {
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
  private cleanupQueue(queue: Queue, maxAgeInSecs: number) : void {
    const toDelete : StringToBooleanMap = {};

    // getTime
    for (const key in queue) {
      if ((queue[key].timestamp as number + (maxAgeInSecs * 1000)) < new Date().getTime()) {
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
  private retrieveBlocks() : void {
    for (const chain in this.chains) {
      this.retrieveBlocksInChain(chain);
    }
  }

  /**
   * Polls chain for new blocks, detecting contract deployments and
   * calling `retrieveBytecode` when one is discovered
   *
   * @param {any} chain [description]
   */
  private retrieveBlocksInChain(chain: any) : void {
    const _this = this;
    const web3 = this.chains[chain].web3;

    web3.eth.getBlockNumber((err: Error, newBlockNr: number) => {
      if (err) return;

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
  private retrieveCode(chain: string, address: string) : void {
    const _this = this;
    const web3 = this.chains[chain].web3;

    web3.eth.getCode(address, (err : Error, bytecode : string) => {
      if (err) return;

      try {
        const cborData = cborDecode(web3.utils.hexToBytes(bytecode))

        if (cborData && 'bzzr1' in cborData) {
          const metadataBzzr1 = web3.utils.bytesToHex(cborData['bzzr1']).slice(2);

          this.log.info(
            {
              loc: '[BLOCKS]',
              chain: chain,
              address: address,
              bzzr1: metadataBzzr1
            },
            'Queueing retrieval of metadata'
          );

          _this.addToQueue(
            _this.chains[chain].metadataQueue,
            address,
            {
              bzzr1: metadataBzzr1,
              bytecode: bytecode
            }
          );

        } else if (cborData && 'ipfs' in cborData){
          const metadataIPFS = multihashes.toB58String(cborData['ipfs']);

          this.log.info(
            {
              loc: '[BLOCKS]',
              chain: chain,
              address: address,
              ipfs: metadataIPFS
            },
            'Queueing retrieval of metadata'
          )

          _this.addToQueue(
            _this.chains[chain].metadataQueue,
            address,
            {
              ipfs: metadataIPFS,
              bytecode: bytecode
            }
          );
        }
      } catch (error) { /* ignore */ }
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
  private retrieveMetadata() : void {
    for (const chain in this.chains) {
      this.retrieveMetadataInChain(chain);
    }
  }

  /**
   * Retrieves metadata from decentralized storage provider
   * for chain after deleting stale metadata queue items.
   * @param {string} chain ex: 'ropsten'
   */
  private retrieveMetadataInChain(chain: string) : void {
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
  ) : Promise<void> {
    let metadataRaw;

    const found: any = {
      files: [],
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

    } else if (metadataIpfs){

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

    found.files.push(metadataRaw.toString())

    const metadata = JSON.parse(metadataRaw);
    delete this.chains[chain].metadataQueue[address];

    this.addToQueue(this.chains[chain].sourceQueue, address, {
      metadataRaw: metadataRaw.toString(),
      sources: metadata.sources,
      found: found
    });
  }


  // =======
  // Sources
  // =======

  /**
   * Queries decentralized storage for solidity files at the location specified by
   * a metadata sources manifest.
   */
  private retrieveSource() : void{
    for (const chain in this.chains) {
      this.retrieveSourceInChain(chain);
    }
  }

  /**
   * Retrieves solidity files by address from decentralized storage provider after
   * deleting stale source queue items.
   * @param {string} chain ex: 'ropsten'
   */
  private retrieveSourceInChain(chain: string) : void {
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
  ) : void {
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
  ) : Promise<void> {
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
  ) : Promise<void> {

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
  ) : Promise<void>{

    this.chains[chain].sourceQueue[address].found.files.push(source);
    delete this.chains[chain].sourceQueue[address].sources[sourceKey]

    const remaining = Object.keys(this.chains[chain].sourceQueue[address].sources)

    this.log.info(
      {
        loc: '[SOURCES]',
        chain: chain,
        address: address,
        sources: remaining
      },
      'Sources left to be retrieved'
    );

    const queueItem = this.chains[chain].sourceQueue[address];

    // Once we've assembled all the sources, inject them.
    // Also save ipfs and swarm hashes.
    if (Object.keys(queueItem.sources).length == 0) {

      const data: InputData = {
        repository: this.repository,
        chain: getChainByName(chain).chainId.toString(),
        addresses: [address],
        files: queueItem.found.files,
        bytecode: queueItem.found.bytecode
      };

      try {
        await this.injector.inject(data)

        if (queueItem.found.swarm){
          save(queueItem.found.swarm.metadataPath, queueItem.found.swarm.file)
        }

        if (queueItem.found.ipfs){
          save(queueItem.found.ipfs.metadataPath, queueItem.found.ipfs.file)
        }
      } catch(err){
        /* ignore */
      }
      delete this.chains[chain].sourceQueue[address];
    }
  }
}
