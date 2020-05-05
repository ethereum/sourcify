const assert = require('assert');
const ganache = require('ganache-cli');
const exec = require('child_process').execSync;
const pify = require('pify');
const Web3 = require('web3');
const IPFS = require('ipfs')
const fs = require('fs');
const path = require('path');
const request = require('request-promise-native')

const { deployFromArtifact, waitSecs } = require('./helpers/helpers');
const SimpleWithImport = require('./sources/pass/simpleWithImport.js');
const Monitor = require('../src/monitor').default;
const getChainByName = require('../src/utils').getChainByName;

describe('monitor', function(){

  describe('E2E', function(){
    let monitor;
    let web3;
    let server;
    let accounts;
    let port = 8545;
    let ipfs;
    let node;
    let chain = 'localhost';
    let mockRepo = 'mockRepository';
    let chainId = getChainByName(chain).chainId.toString();

    before(async function(){
      server = ganache.server({blockTime: 1});
      await pify(server.listen)(port);
      web3 = new Web3(`http://${chain}:${port}`);
      accounts = await web3.eth.getAccounts();
    });

    // Clean up server
    after(async function(){
      monitor.stop();
      await pify(server.close)();
      await ipfs.stop();

      try { exec(`rm -rf ${mockRepo}`) } catch(err) { /*ignore*/ }
    });

    it('SimpleWithImport: matches deployed to IPFS sources', async function(){
      this.timeout(25000);

      const customChain = {
        url: `http://${chain}:${port}`,
        name: chain
      };

      ipfs = await IPFS.create({
        offline: true,
        silent: true
      });

      monitor = new Monitor({
        blockTime: 1,
        ipfsProvider: ipfs,
        repository: mockRepo,
        silent: true
      });

      await monitor.start(customChain);

      const sourceAIpfs = await ipfs.add(SimpleWithImport.sourceCodes["SimpleWithImport.sol"]);
      const sourceBIpfs = await ipfs.add(SimpleWithImport.sourceCodes["Import.sol"]);
      const metadataIpfs = await ipfs.add(SimpleWithImport.compilerOutput.metadata);

      const instance = await deployFromArtifact(web3, SimpleWithImport);
      const address = instance.options.address;

      await waitSecs(10);

      // Verify metadata stored
      const addressMetadataPath = path.join(mockRepo, 'contract', chainId, address, 'metadata.json');
      const ipfsMetadataPath = path.join(mockRepo, 'ipfs', metadataIpfs[0].path);

      const addressMetadata = fs.readFileSync(addressMetadataPath, 'utf-8');
      const ipfsMetadata = fs.readFileSync(ipfsMetadataPath, 'utf-8');

      assert.equal(addressMetadata, SimpleWithImport.compilerOutput.metadata);
      assert.equal(ipfsMetadata, SimpleWithImport.compilerOutput.metadata);

      // Verify source stored
      const metadata = JSON.parse(SimpleWithImport.compilerOutput.metadata);

      // Source keys sorted alpha
      const importKey = Object.keys(metadata.sources)[0];
      const simpleWithImportKey = Object.keys(metadata.sources)[1];

      const importPath = path.join(
        mockRepo,
        'contract',
        chainId,
        address,
        'sources',
        importKey
      );

      const simpleWithImportPath = path.join(
        mockRepo,
        'contract',
        chainId,
        address,
        'sources',
        simpleWithImportKey
      );

      const savedImportSource = fs.readFileSync(importPath, 'utf-8');
      const savedSimpleWithImportSource = fs.readFileSync(simpleWithImportPath, 'utf-8');

      assert.equal(savedImportSource, SimpleWithImport.sourceCodes["Import.sol"]);
      assert.equal(savedSimpleWithImportSource, SimpleWithImport.sourceCodes["SimpleWithImport.sol"])
    });
  });
});
