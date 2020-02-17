const assert = require('assert');
const ganache = require('ganache-cli');
const exec = require('child_process').execSync;
const pify = require('pify');
const dagPB = require('ipld-dag-pb');
const UnixFS = require('ipfs-unixfs');
const multihashes = require('multihashes');
const fs = require('fs');
const Web3 = require('web3');
const Simple = require('./sources/pass/simple.js');
const { deployFromArtifact } = require('./helpers/helpers');
const Injector = require('../src/injector');

describe('injector', function(){
  it.skip('findMetadataFile: identifies a metadata file in a group of files');
  it.skip('findMetadataFile: errors when no metadata file is present');

  it.skip('rearrangeSources: checks submitted sources against expected metadata hash');
  it.skip('rearrangeSources: assembles submitted sources into a fileName-to-content map');

  it.skip('storeData: writes metadata and sources to the repository');
  it.skip('storeData: errors if the recompiled bytecode has no metadata hash')

  describe('inject', function(){
    let server;
    let port = 8545;
    let chain = 'localhost';
    let mockRepo = 'mockRepository';
    let injector = new Injector();
    let web3;

    before(async function(){
      server = ganache.server();
      await pify(server.listen)(port);
      web3 = new Web3(`http://${chain}:${port}`);
    })

    // Clean up repository
    afterEach(function(){
      try { exec(`rm -rf ${mockRepo}`) } catch(err) { /*ignore*/ }
    })

    // Clean up server
    after(async function(){
      await pify(server.close)();
    });

    it('verifies sources from metadata with an address & stores by IPFS hash', async function(){
      this.timeout(15000);

      const source = Simple.sourceCodes["Simple.sol"];
      const metadata = Simple.compilerOutput.metadata;
      const instance = await deployFromArtifact(web3, Simple);

      // Inject by address into repository after recompiling
      await injector.inject(
        mockRepo,
        'localhost',
        instance.options.address,
        [source, metadata]
      );

      // Verify metadata was stored to repository, indexed by ipfs hash
      const file = new UnixFS('file', Buffer.from(metadata));
      const node = new dagPB.DAGNode(file.marshal());
      const metadataLink = await node.toDAGLink()
      const ipfsHash = multihashes.toB58String(metadataLink._cid.multihash);

      const ipfsMetadata = fs.readFileSync(`${mockRepo}/ipfs/${ipfsHash}`, 'utf-8');
      assert.equal(ipfsMetadata, metadata);
    });

    it.skip('verifies sources from metadata after checking address DB & stores by IPFS hash');
    it.skip('errors if bytecode fetched by address does not match recompilation hash');
    it.skip('errors when no address supplied and no hash matches in the address DB');
  });
})
