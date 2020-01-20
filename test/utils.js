const assert = require('assert');
const simple = require('./sources/pass/simple.js');
const dagPB = require('ipld-dag-pb');
const UnixFS = require('ipfs-unixfs');
const multihashes = require('multihashes');
const web3 = require('web3');

const { cborDecode, inject } = require('../injector');

const util = require('util')

describe('utils', function(){

  it('cborDecode: extracts an ipfs hash from bytecode which matches metadata hash', async function(){
    const metadata = simple.compilerOutput.metadata;
    const deployedBytecode = simple.compilerOutput.evm.deployedBytecode.object;
    const cborData = cborDecode(web3.utils.hexToBytes(deployedBytecode))

    // Create IPFS dag node for metadata
    const file = new UnixFS('file', Buffer.from(metadata));
    const node = new dagPB.DAGNode(file.marshal());

    // Convert metadata node and extracted bytecode hashes to DAGLink objects
    const metadataLink = await node.toDAGLink()
    const bytecodeLink = new dagPB.DAGLink('', 0, cborData['ipfs']);

    // Extract ipfs
    const metadataHash = multihashes.toB58String(metadataLink._cid.multihash);
    const bytecodeHash = bytecodeLink.toJSON().cid;

    assert.equal(metadataHash, bytecodeHash);
  });

  it.skip('getBytecode: gets bytecode for address');
  it.skip('recompile: compiles sources with metadata spec. compiler');
  it.skip('recompile: errors on compilation failure');
  it.skip('reformatMetadata: synthesizes a compiler input from sources and metadata');
  it.skip('reformatMetadata: throws if compilation target is missing');
  it.skip('getBytecodeMetadataAndSources:')
})
