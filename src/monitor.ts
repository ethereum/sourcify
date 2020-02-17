import Web3 from 'web3';
import { ethers } from 'ethers';
import request from  'request-promise-native';

import {
  outputFileSync,
  readFileSync
} from 'fs-extra';

import { cborDecode } from './utils';
import { BlockTransactionObject } from 'web3-eth';

const multihashes = require('multihashes');

const read = readFileSync;
const save = outputFileSync;
const log = console.log;

export interface MonitorConfig {
  ipfsCatRequest? : string,
  ipfsProvider? : any,
  swarmGateway? : string,
  repository? : string,
  infuraPID? : string,
  blockTime? : number,
}

export interface CustomChainConfig {
  name: string,
  url: string
}

export default class Monitor {
  private chains : any;
  private ipfsCatRequest: string;
  private ipfsProvider: any;
  private swarmGateway: string;
  private repository: string;
  private infuraPID: string;;
  private blockTime: number;
  private blockInterval: any;
  private sourceInterval: any;
  private metadataInterval: any;

  constructor(config: MonitorConfig = {}) {
    this.chains = {};

    this.ipfsCatRequest = config.ipfsCatRequest || 'https://ipfs.infura.io:5001/api/v0/cat?arg=';
    this.ipfsProvider = config.ipfsProvider || null;
    this.swarmGateway = 'https://swarm-gateways.net/';
    this.repository = config.repository || 'repository';
    this.infuraPID = config.infuraPID || '891fe57328084fcca24912b662ad101f';
    this.blockTime = config.blockTime || 15 // seconds;

    this.blockInterval = null;
    this.sourceInterval = null;
    this.metadataInterval = null;
  }

  public async start(customChain : CustomChainConfig) : Promise<void> {
    const chainNames: string[] = customChain
      ? [customChain.name]
      : ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli'];

    for (let chain of chainNames){
      let url : string = customChain ? customChain.url : `https://${chain}.infura.io/v3/${this.infuraPID}`;

      this.chains[chain] = {
        web3: new Web3(url),
        metadataQueue: {},
        sourceQueue: {},
        latestBlock: 0
      };

      const blockNumber = await this.chains[chain].web3.eth.getBlockNumber();
      this.chains[chain].latestBlock = blockNumber;
      log(`${chain}: Starting from block ${blockNumber}`);
    }

    this.blockInterval = setInterval(this.retrieveBlocks.bind(this), 1000 * this.blockTime);
    this.metadataInterval = setInterval(this.retrieveMetadata.bind(this), 1000 * this.blockTime);
    this.sourceInterval = setInterval(this.retrieveSource.bind(this), 1000 * this.blockTime);
  }

  public stop() : void {
    log('Stopping monitor...')
    clearInterval(this.blockInterval);
    clearInterval(this.metadataInterval);
    clearInterval(this.sourceInterval);
  }

  private async ipfsCat(hash: string) : Promise<string> {
    return (this.ipfsProvider)
      ? this.ipfsProvider.cat(`/ipfs/${hash}`)
      : request(`${this.ipfsCatRequest}${hash}`);
  }

  private addToQueue(queue:any, key:string, item: any) : void {
    if (queue[key] !== undefined)
      return;
    item.timestamp = new Date();
    queue[key] = item;
  }

  private cleanupQueue(queue: any, maxAgeInSecs: number) : void {
    const toDelete : any = {};

    for (let key in queue) {
      if (queue[key].timestamp + maxAgeInSecs * 1000 < new Date()) {
        toDelete[key] = true;
      }
    }
    for (let key in toDelete) {
      delete queue[key]
    }
  }

  // =======
  // Blocks
  // =======

  private retrieveBlocks() : void {
    for (let chain in this.chains) {
      this.retrieveBlocksInChain(chain);
    }
  }

  private retrieveBlocksInChain(chain: any) : void {
    const _this = this;
    const web3 = this.chains[chain].web3;

    web3.eth.getBlockNumber((err: Error, newBlockNr: number) => {
      newBlockNr = Math.min(newBlockNr, _this.chains[chain].latestBlock + 4);

      for (; _this.chains[chain].latestBlock < newBlockNr; _this.chains[chain].latestBlock++) {
        const latest = _this.chains[chain].latestBlock;

        web3.eth.getBlock(latest, true, (err: Error, block: BlockTransactionObject) => {
          if (err || !block) {
            const latest = _this.chains[chain].latestBlock;
            log(`[BLOCKS] ${chain} Block ${latest} not available: ${err}`);
            return;
          }

          log(`[BLOCKS] ${chain} Processing Block ${block.number}:`);

          for (var i in block.transactions) {
            let t = block.transactions[i]
            if (t.to === null) {
              const address = ethers.utils.getContractAddress(t);
              log(`[BLOCKS] ${address}`);
              _this.retrieveCode(chain, address);
            }
          }
        })
      }
    })
  }

  private retrieveCode(chain: string, address: string) : void {
    const _this = this;
    const web3 = this.chains[chain].web3;

    web3.eth.getCode(address, (err : Error, bytecode : string) => {
      try {
        const cborData = cborDecode(web3.utils.hexToBytes(bytecode))

        if (cborData && 'bzzr1' in cborData) {
          const metadataBzzr1 = web3.utils.bytesToHex(cborData['bzzr1']).slice(2);

          log(
            `[BLOCKS] Queueing retrieval of metadata for ${chain} ${address} ` +
            `: bzzr1 ${metadataBzzr1}`
          );

          _this.addToQueue(
            _this.chains[chain].metadataQueue,
            address,
            {bzzr1: metadataBzzr1}
          );

        } else if (cborData && 'ipfs' in cborData){
          const metadataIPFS = multihashes.toB58String(cborData['ipfs']);

          log(
            `[BLOCKS] Queueing retrieval of metadata for ${chain} ${address} ` +
            `: ipfs ${metadataIPFS}`
          )

          _this.addToQueue(
            _this.chains[chain].metadataQueue,
            address,
            {ipfs: metadataIPFS}
          );
        }
      } catch (error) { /* ignore */ }
    })
  }

  // =========
  // Metadata
  // =========

  private retrieveMetadata() : void {
    for (let chain in this.chains) {
      this.retrieveMetadataInChain(chain);
    }
  }

  private retrieveMetadataInChain(chain: string) : void {
    const _this = this;
    log(`[METADATA] ${chain} Processing metadata queue...`);

    /// Try to retrieve metadata for one hour
    this.cleanupQueue(this.chains[chain].metadataQueue, 3600)
    for (let address in this.chains[chain].metadataQueue) {
      log(`[METADATA] ${address}`);

      this.retrieveMetadataByStorageProvider(
        chain,
        address,
        this.chains[chain].metadataQueue[address]['bzzr1'],
        this.chains[chain].metadataQueue[address]['ipfs']
      );
    }
  }

  private async retrieveMetadataByStorageProvider(
    chain: string,
    address: string,
    metadataBzzr1: string,
    metadataIpfs: string
  ) : Promise<void> {
    let metadataRaw

    if (metadataBzzr1) {

      try {
        // TODO guard against too large files
        // TODO only write files after recompilation check?
        metadataRaw = await request(`${this.swarmGateway}/bzz-raw:/${metadataBzzr1}`);
        save(`${this.repository}/swarm/bzzr1/${metadataBzzr1}`, metadataRaw);
      } catch (error) { return }

    } else if (metadataIpfs){

      try {
        metadataRaw = await this.ipfsCat(metadataIpfs);
        save(`${this.repository}/ipfs/${metadataIpfs}`, metadataRaw.toString());
      } catch (error) { return }
    }

    log(`[METADATA] Got metadata for ${chain} ${address}`);
    save(`${this.repository}/contract/${chain}/${address}/metadata.json`, metadataRaw.toString());

    const metadata = JSON.parse(metadataRaw);
    delete this.chains[chain].metadataQueue[address];

    this.addToQueue(this.chains[chain].sourceQueue, address, {
      metadataRaw: metadataRaw.toString(),
      sources: metadata.sources
    });
  }


  // =======
  // Sources
  // =======

  private retrieveSource() : void{
    for (let chain in this.chains) {
      this.retrieveSourceInChain(chain);
    }
  }

  private retrieveSourceInChain(chain: string) : void {
    log("[SOURCE] Processing source queue...");

    /// Try to retrieve source for five days.
    this.cleanupQueue(this.chains[chain].sourceQueue, 3600 * 24 * 5)

    for (let address in this.chains[chain].sourceQueue) {
      log(`[SOURCE] ${chain} ${address}`);
      this.retrieveSourceByAddress(
        chain,
        address,
        this.chains[chain].sourceQueue[address].metadataRaw,
        this.chains[chain].sourceQueue[address].sources
      );
    }
  }

  private retrieveSourceByAddress(
    chain: string,
    address: string,
    metadataRaw: string,
    sources: any
  ) : void {
    const _this = this;

    for (let sourceKey in sources) {
      for (let url of sources[sourceKey]['urls']) {
        this.retrieveSwarmSource(chain, address, sourceKey, url);
        this.retrieveIpfsSource(chain, address, sourceKey, url);
      }

      const keccakPath = `${this.repository}/keccak256/${sources[sourceKey].keccak256}`;

      try {
        const data = read(keccakPath);
        this.sourceFound(chain, address, sourceKey, data.toString());

      } catch(err) { /* ignore */ }
    }
  }

  private async retrieveSwarmSource(
    chain: string,
    address: string,
    sourceKey: string,
    url: string
  ) : Promise<void> {
    if (!url.startsWith('bzz-raw')) return;

    try {
      const source = await request(`${this.swarmGateway}${url}`);
      this.sourceFound(chain, address, sourceKey, source);
    } catch (error) {
      // ignore
    }
  }

  private async retrieveIpfsSource(
    chain: string,
    address: string,
    sourceKey: string,
    url: string
  ) : Promise<void> {

    if (!url.startsWith('dweb')) return;

    try {
      const source = await this.ipfsCat(url.split('dweb:/ipfs/')[1]);
      this.sourceFound(chain, address, sourceKey, source.toString());
    } catch (error) {
      // ignore
    }
  }

  private sourceFound(
    chain: string,
    address: string,
    sourceKey: string,
    source: string
  ) : void {

    const pathSanitized : string = sourceKey
      .replace(/[^a-z0-9_.\/-]/gim, "_")
      .replace(/(^|\/)[.]+($|\/)/, '_');

    save(`${this.repository}/contract/${chain}/${address}/sources/${pathSanitized}`, source);

    delete this.chains[chain].sourceQueue[address].sources[sourceKey]

    log(`[SOURCES] ${chain} ${address} Sources left to be retrieved: `);
    log(Object.keys(this.chains[chain].sourceQueue[address].sources));

    if (Object.keys(this.chains[chain].sourceQueue[address].sources).length == 0) {
      delete this.chains[chain].sourceQueue[address];
    }
  }
}
