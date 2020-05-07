process.env.TESTING = true;
process.env.SERVER_PORT=2000;
process.env.LOCALCHAIN_URL="http://localhost:8545";
process.env.MOCK_REPOSITORY='./mockRepository';

const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const ganache = require('ganache-cli');
const exec = require('child_process').execSync;
const pify = require('pify');
const Web3 = require('web3');
const read = require('fs').readFileSync;
const util = require('util');
const path = require('path');

const app = require('../src/server').default;
const getChainId = require('../src/utils').getChainId;
const { deployFromArtifact } = require('./helpers/helpers');

const Simple = require('./sources/pass/simple.js');
const simpleMetadataPath = './test/sources/all/simple.meta.json';
const simpleSourcePath = './test/sources/all/Simple.sol';
const simpleMetadataJSONPath = './test/sources/metadata/simple.meta.object.json';
const importSourcePath = './test/sources/all/Import.sol';
const simpleWithImportSourcePath = './test/sources/all/SimpleWithImport.sol';
const simpleWithImportMetadataPath = './test/sources/all/simpleWithImport.meta.json';

chai.use(chaiHttp);

describe("server", function() {
  this.timeout(15000);

  let server;
  let web3;
  let simpleInstance;
  let serverAddress = 'http://localhost:2000';
  let chainId = getChainId('localhost');

  before(async function(){
    server = ganache.server({chainId: chainId});
    await pify(server.listen)(8545);
    web3 = new Web3(process.env.LOCALCHAIN_URL);
    simpleInstance = await deployFromArtifact(web3, Simple);
  });

  // Clean up repository
  afterEach(function(){
    try { exec(`rm -rf ${process.env.MOCK_REPOSITORY}`) } catch(err) { /*ignore*/ }
  })

  // Clean up server
  after(async function(){
    await pify(server.close)();
  });

  it("when submitting a valid request (stringified metadata)", function(done){
    const expectedPath = path.join(
      process.env.MOCK_REPOSITORY,
      'contract',
      chainId.toString(),
      simpleInstance.options.address,
      'metadata.json'
    );

    const submittedMetadata = read(simpleMetadataPath, 'utf-8');

    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleMetadataPath), "simple.meta.json")
      .attach("files", read(simpleSourcePath), "Simple.sol")
      .field("address", simpleInstance.options.address)
      .field("chain", 'localhost')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 200);

        // Reponse should be array of matches
        const text = JSON.parse(res.text);
        assert.equal(text.result[0].status, 'perfect');
        assert.equal(text.result[0].address, simpleInstance.options.address);

        // Verify sources were written to repo
        const saved = JSON.stringify(read(expectedPath, 'utf-8'));
        assert.equal(saved, submittedMetadata.trim());
        done();
      });
  });

  it("when submitting a valid request (json formatted metadata)", function(done){
    const expectedPath = path.join(
      process.env.MOCK_REPOSITORY,
      'contract',
      chainId.toString(),
      simpleInstance.options.address,
      'metadata.json'
    );

    // The injector will save a stringified version
    const stringifiedMetadata = read(simpleMetadataPath, 'utf-8');

    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleMetadataJSONPath), "simple.meta.object.json")
      .attach("files", read(simpleSourcePath), "Simple.sol")
      .field("address", simpleInstance.options.address)
      .field("chain", 'localhost')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 200);

        // Verify sources were written to repo
        const saved = JSON.stringify(read(expectedPath, 'utf-8'));
        assert.equal(saved, stringifiedMetadata.trim());
        done();
      });
  });

  it("when submitting and bytecode does not match (error)", function(done){
    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleWithImportMetadataPath), "simpleWithImport.meta.json")
      .attach("files", read(simpleWithImportSourcePath), "SimpleWithImport.sol")
      .attach("files", read(importSourcePath), "Import.sol")
      .field("address", simpleInstance.options.address)
      .field("chain", 'localhost')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 404);

        const result = JSON.parse(res.text);
        assert(result.error.includes("Could not match on-chain deployed bytecode"));
        done();
      });
  });

  it("when submitting a single metadata file (error)", function(done){
    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleMetadataPath), "simple.meta.json")
      .field("address", simpleInstance.options.address)
      .field("chain", 'localhost')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 500);
        assert(res.error.text.includes('metadata file mentions a source file'));
        assert(res.error.text.includes('cannot be found in your upload'));
        done();
      });
  });

  it("when submitting a single source file (error)", function(done){
    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleSourcePath), "Simple.sol")
      .field("address", simpleInstance.options.address)
      .field("chain", 'localhost')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 500);
        assert(res.error.text.includes('Metadata file not found'));
        done();
      });
  });

  it("when submitting without an address (error)", function(done){
    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleMetadataPath), "simple.meta.json")
      .attach("files", read(simpleSourcePath), "Simple.sol")
      .field("chain", 'localhost')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 500);
        assert(res.error.text.includes('Missing address'));
        done();
      });
  });

  it("when submitting without a chain name (error)", function(done){
    chai.request(serverAddress)
      .post('/')
      .attach("files", read(simpleMetadataPath), "simple.meta.json")
      .attach("files", read(simpleSourcePath), "Simple.sol")
      .field("address", simpleInstance.options.address)
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 404);
        assert(res.error.text.includes('Chain undefined not supported'));
        done();
      });
  });

  it("get /health", function(done){
    chai.request(serverAddress)
      .get('/health')
      .end(function (err, res) {
        assert.equal(err, null);
        assert.equal(res.status, 200);
        assert(res.text.includes('Alive and kicking!'))
        done();
      });
  });

  describe("when submitting only an address / chain pair", function(){

    // Setup: write "Simple.sol" to repo
    beforeEach(function(done){
      chai.request(serverAddress)
        .post('/')
        .attach("files", read(simpleMetadataPath), "simple.meta.json")
        .attach("files", read(simpleSourcePath), "Simple.sol")
        .field("address", simpleInstance.options.address)
        .field("chain", 'localhost')
        .end(function (err, res) {
          assert.equal(res.status, 200);
          done();
        });
    });

    afterEach(function(){
      try { exec(`rm -rf ${process.env.MOCK_REPOSITORY}`) } catch(err) { /*ignore*/ }
    });

    it("when address / chain exist (success)", function(done){
      chai.request(serverAddress)
        .post('/')
        .field("address", simpleInstance.options.address)
        .field("chain", 'localhost')
        .end(function (err, res) {
          assert.equal(err, null);
          assert.equal(res.status, 200);

          const text = JSON.parse(res.text);
          assert.equal(text.result[0].status, 'perfect');
          assert.equal(text.result[0].address, simpleInstance.options.address);

          done();
        });
    });

    it("when chain does not exist (error)", function(done){
      chai.request(serverAddress)
        .post('/')
        .field("address", simpleInstance.options.address)
        .field("chain", 'bitcoin_diamond_lottery')
        .end(function (err, res) {
          assert.equal(err, null);
          assert.equal(res.status, 404);

          const result = JSON.parse(res.text);
          assert.equal(result.error, "Chain bitcoin_diamond_lottery not supported!");
          done();
        });
    });

    it("when address does not exist (error)", function(done){
      chai.request(serverAddress)
        .post('/')
        .field("address", "0xabcde")
        .field("chain", 'localhost')
        .end(function (err, res) {
          assert.equal(err, null);
          assert.equal(res.status, 404);

          const result = JSON.parse(res.text);
          assert.equal(result.error, "Address for specified chain not found in repository");
          done();
        });
    });
  });
});
