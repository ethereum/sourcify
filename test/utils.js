// const assert = require('assert');
// const simple = require('./sources/pass/simple.js');
// const bzzr0 = require('./sources/pass/simple.bzzr0.js');
// const bzzr1 = require('./sources/pass/simple.bzzr1.js');
// const dagPB = require('ipld-dag-pb');
// const UnixFS = require('ipfs-unixfs');
// const multihashes = require('multihashes');
// const web3 = require('web3');

// const {
//     cborDecode,
//     getBytecodeWithoutMetadata
// } = require('../src/utils/Utils');

// describe('utils', function () {

//     it('cborDecode: extracts an ipfs hash from bytecode which matches metadata hash', async function () {
//         const metadata = simple.compilerOutput.metadata;
//         const deployedBytecode = simple.compilerOutput.evm.deployedBytecode.object;
//         const cborData = cborDecode(web3.utils.hexToBytes(deployedBytecode))

//         // Create IPFS dag node for metadata
//         const file = new UnixFS('file', Buffer.from(metadata));
//         const node = new dagPB.DAGNode(file.marshal());

//         // Convert metadata node hash to DAGLink object
//         const metadataLink = await node.toDAGLink()

//         // Extract ipfs
//         const metadataHash = multihashes.toB58String(metadataLink._cid.multihash);
//         const bytecodeHash = multihashes.toB58String(cborData['ipfs']);

//         assert.equal(metadataHash, bytecodeHash);
//     });

//     it('getBytecodeWithoutMetadata: removes metadata (IPFS)', function () {
//         const deployedBytecode = simple.compilerOutput.evm.deployedBytecode.object;
//         const trimmed = getBytecodeWithoutMetadata(deployedBytecode);
//         const diffLength = deployedBytecode.length - trimmed.length;
//         const metadata = deployedBytecode.slice(-diffLength);

//         // a264 is the ipfs prefix for the metadata section...
//         assert.equal(metadata.slice(0, 4), "a264");
//     });

//     it('getBytecodeWithoutMetadata: removes metadata (bzzr0)', function () {
//         const deployedBytecode = bzzr0.compilerOutput.evm.deployedBytecode.object;
//         const trimmed = getBytecodeWithoutMetadata(deployedBytecode);
//         const diffLength = deployedBytecode.length - trimmed.length;
//         const metadata = deployedBytecode.slice(-diffLength);

//         // a265 is the bzzr prefix for the metadata section...
//         assert.equal(metadata.slice(0, 4), "a265");
//     });

//     it('getBytecodeWithoutMetadata: removes metadata (bzzr1)', function () {
//         const deployedBytecode = bzzr1.compilerOutput.evm.deployedBytecode.object;
//         const trimmed = getBytecodeWithoutMetadata(deployedBytecode);
//         const diffLength = deployedBytecode.length - trimmed.length;
//         const metadata = deployedBytecode.slice(-diffLength);

//         // a265 is the bzzr prefix for the metadata section...
//         assert.equal(metadata.slice(0, 4), "a265");
//     });

//     it.skip('getBytecode: gets bytecode for address');
//     it.skip('recompile: compiles sources with metadata spec. compiler');
//     it.skip('recompile: errors on compilation failure');
//     it.skip('reformatMetadata: synthesizes a compiler input from sources and metadata');
//     it.skip('reformatMetadata: throws if compilation target is missing');
// })
