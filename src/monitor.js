const Web3 = require('web3')
const ethers = require('ethers')
const cbor = require('cbor')
const request = require('request-promise-native');
const fs = require('fs')
const fsextra = require('fs-extra')
const multihashes = require('multihashes')

const save = fsextra.outputFileSync;

class Monitor {
    constructor(config={}) {
        this.chains = {};

        this.ipfsCatRequest = config.ipfsCatRequest || 'https://ipfs.infura.io:5001/api/v0/cat?arg=';
        this.ipfsProvider = config.ipfsProvider || null;
        this.swarmGateway = 'https://swarm-gateways.net/';
        this.repository = config.repository || 'repository';
        this.infuraPID = config.infuraPID || '891fe57328084fcca24912b662ad101f';
        this.blockTime = config.blockTime || 15 // seconds

        this.blockInterval;
        this.metadataInterval;
        this.sourceInterval;
    }

    async start(customChain){
        const chainNames = customChain
            ? [customChain.name]
            : ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli'];

        for (let chain of chainNames){
            let url = customChain ? customChain.url : `https://${chain}.infura.io/v3/${this.infuraPID}`;

            this.chains[chain] = {
                web3: new Web3(url),
                metadataQueue: {},
                sourceQueue: {},
                latestBlock: 0
            };

            const blockNumber = await this.chains[chain].web3.eth.getBlockNumber();
            console.log(chain + ": Starting from block " + blockNumber);
            this.chains[chain].latestBlock = blockNumber;
        }

        this.blockInterval = setInterval(this.retrieveBlocks.bind(this), 1000 * this.blockTime);
        this.metadataInterval = setInterval(this.retrieveMetadata.bind(this), 1000 * this.blockTime);
        this.sourceInterval = setInterval(this.retrieveSource.bind(this), 1000 * this.blockTime);
    }

    stop(){
        console.log('Stopping monitor...')
        clearInterval(this.blockInterval);
        clearInterval(this.metadataInterval);
        clearInterval(this.sourceInterval);
    }

    cborDecode(bytecode){
        const cborLength = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1];
        const segment = new Buffer(bytecode.slice(bytecode.length - 2 - cborLength, -2))
        return cbor.decodeFirstSync(segment);
    }

    async ipfsCat(hash){
        return (this.ipfsProvider)
            ? this.ipfsProvider.cat(`/ipfs/${hash}`)
            : request(`${this.ipfsCatRequest}${hash}`);
    }

    addToQueue(queue, key, item){
        if (queue[key] !== undefined)
            return;
        item.timestamp = +new Date;
        queue[key] = item;
    }

    cleanupQueue(queue, maxAgeInSecs){
        let toDelete = {}
        for (let key in queue) {
            if (queue[key].timestamp + maxAgeInSecs * 1000 < +new Date) {
                toDelete[key] = true
            }
        }
        for (let key in toDelete) {
            delete queue[key]
        }
    }

    // =======
    // Blocks
    // =======

    retrieveBlocks(){
        for (let chain in this.chains) {
            this.retrieveBlocksInChain(chain);
        }
    }

    retrieveBlocksInChain(chain){
        const _this = this;
        const web3 = this.chains[chain].web3;

        web3.eth.getBlockNumber((err, newBlockNr) => {

            newBlockNr = Math.min(newBlockNr, _this.chains[chain].latestBlock + 4);

            for (; _this.chains[chain].latestBlock < newBlockNr; _this.chains[chain].latestBlock++) {
                web3.eth.getBlock(_this.chains[chain].latestBlock, true, (err, block) => {
                    if (err || !block) {
                        console.log("[BLOCKS] " + chain + " Block " + _this.chains[chain].latestBlock + " not available: " + err);
                        return;
                    }
                    console.log("[BLOCKS] " + chain + " Processing Block " + block.number + ":");
                    for (var i in block.transactions) {
                        let t = block.transactions[i]
                        if (t.to === null) {
                            let address = ethers.utils.getContractAddress(t);
                            console.log("[BLOCKS] " + address);
                            _this.retrieveCode(chain, address);
                        }
                    }
                })
            }
        })
    }

    retrieveCode(chain, address){
        const _this = this;
        let web3 = this.chains[chain].web3;
        web3.eth.getCode(address, (err, bytecode) => {
            try {
                let cborData = _this.cborDecode(web3.utils.hexToBytes(bytecode))
                if (cborData && 'bzzr1' in cborData) {
                    let metadataBzzr1 = web3.utils.bytesToHex(cborData['bzzr1']).slice(2)
                    console.log("[BLOCKS] Queueing retrievel of metadata for " + chain + " " + address + ": bzzr1 " + metadataBzzr1)
                    _this.addToQueue(_this.chains[chain].metadataQueue, address, {bzzr1: metadataBzzr1});
                } else if (cborData && 'bzzr0' in cborData) {
                    let metadataBzzr0 = web3.utils.bytesToHex(cborData['bzzr0']).slice(2);
                    console.log("[BLOCKS] Queueing retrievel of metadata for " + chain + " " + address + ": bzzr0 " + metadataBzzr0)
                    _this.addToQueue(_this.chains[chain].metadataQueue, address, {bzzr0: metadataBzzr0});
                } else if (cborData && 'ipfs' in cborData){
                    let metadataIPFS = multihashes.toB58String(cborData['ipfs']);
                    console.log("[BLOCKS] Queueing retrievel of metadata for " + chain + " " + address + ": ipfs " + metadataIPFS)
                    _this.addToQueue(_this.chains[chain].metadataQueue, address, {ipfs: metadataIPFS});
                }
            } catch (error) {}
        })
    }

    // =========
    // Metadata
    // =========

    retrieveMetadata(){
        for (let chain in this.chains) {
            this.retrieveMetadataInChain(chain);
        }
    }

    retrieveMetadataInChain(chain, gateway){
        const _this = this;
        console.log("[METADATA] " + chain + " Processing metadata queue...");

        /// Try to retrieve metadata for one hour
        this.cleanupQueue(this.chains[chain].metadataQueue, 3600)
        for (let address in this.chains[chain].metadataQueue) {
            console.log("[METADATA] " + address);

            this.retrieveMetadataByStorageProvider(
                chain,
                address,
                this.chains[chain].metadataQueue[address]['bzzr1'],
                this.chains[chain].metadataQueue[address]['bzzr0'],
                this.chains[chain].metadataQueue[address]['ipfs']
            );
        }
    }

    async retrieveMetadataByStorageProvider(
        chain,
        address,
        metadataBzzr1,
        metadataBzzr0,
        metadataIpfs
    ){
        let metadataRaw

        if (metadataBzzr1) {

            try {
                // TODO guard against too large files
                // TODO only write files after recompilation check?
                metadataRaw = await request(`${this.swarmGateway}/bzz-raw:/${metadataBzzr1}`);
                save(`${this.repository}/swarm/bzzr1/${metadataBzzr1}`, metadataRaw);
            } catch (error) { return }

        } else if (metadataBzzr0) {

            try {
                metadataRaw = fs.readFileSync(`${_this.repository}/swarm/bzzr0/${metadataBzzr0}`)
            } catch (error) { return }

        } else if (metadataIpfs){

            try {
                metadataRaw = await this.ipfsCat(metadataIpfs);
                save(`${this.repository}/ipfs/${metadataIpfs}`, metadataRaw.toString());
            } catch (error) { return }
        }

        console.log("[METADATA] Got metadata for " + chain + " " + address);
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

    retrieveSource(){
        for (let chain in this.chains) {
            this.retrieveSourceInChain(chain);
        }
    }

    retrieveSourceInChain(chain){
        console.log("[SOURCE] Processing source queue...");

        /// Try to retrieve source for five days.
        this.cleanupQueue(this.chains[chain].sourceQueue, 3600 * 24 * 5)

        for (let address in this.chains[chain].sourceQueue) {
            console.log("[SOURCE] " + chain + " " + address);
            this.retrieveSourceByAddress(
                chain,
                address,
                this.chains[chain].sourceQueue[address].metadataRaw,
                this.chains[chain].sourceQueue[address].sources
            );
        }
    }

    retrieveSourceByAddress(chain, address, metadataRaw, sources){
        const _this = this;

        for (let sourceKey in sources) {
            for (let url of sources[sourceKey]['urls']) {
                this.retrieveSwarmSource(chain, address, sourceKey, url);
                this.retrieveIpfsSource(chain, address, sourceKey, url);
            }

            const keccakPath = `${this.repository}/keccak256/${sources[sourceKey]['keccak256']}`;
            fs.readFile(keccakPath, (err, data) => {
                if (!err) {
                    _this.sourceFound(chain, address, s, data.toString());
                }
            });
        }
    }

    async retrieveSwarmSource(chain, address, sourceKey, url){
        if (!url.startsWith('bzz-raw')) return;

        try {
            const source = await request(`${this.swarmGateway}${url}`);
            this.sourceFound(chain, address, sourceKey, source);
        } catch (error) {
            // ignore
        }
    }

    async retrieveIpfsSource(chain, address, sourceKey, url){
        if (!url.startsWith('dweb')) return;

        try {
            const source = await this.ipfsCat(url.split('dweb:/ipfs/')[1]);
            this.sourceFound(chain, address, sourceKey, source.toString());
        } catch (error) {
            // ignore
        }
    }

    sourceFound(chain, address, sourceKey, source){
        const pathSanitized = sourceKey
            .replace(/[^a-z0-9_.\/-]/gim, "_")
            .replace(/(^|\/)[.]+($|\/)/, '_');

        save(`${this.repository}/contract/${chain}/${address}/sources/${pathSanitized}`, source);

        delete this.chains[chain].sourceQueue[address].sources[path]
        console.log("[SOURCES] " + chain + " " + address + " Sources left to be retrieved: ");
        console.log(Object.keys(this.chains[chain].sourceQueue[address].sources));
        if (Object.keys(this.chains[chain].sourceQueue[address].sources).length == 0) {
            delete this.chains[chain].sourceQueue[address];
        }
    }
}

module.exports = Monitor;
