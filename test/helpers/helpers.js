const dagPB = require('ipld-dag-pb');
const UnixFS = require('ipfs-unixfs');
const multihashes = require('multihashes');
const Web3 = require('web3');
const utils = require('./../../src/utils');

/**
 * Deploys a contract to testrpc
 * @param  {Object} web3
 * @param  {Object} artifact     ex: const Simple = require('./sources/pass/simple.js');
 * @param  {String} contractName ex: "Simple.sol"
 * @param  {String} address      library address
 * @return {Web3Contract}        deployed contract instance
 */
async function deployFromArtifact(web3, artifact, address){
  const accounts = await web3.eth.getAccounts();
  const abi = artifact.compilerOutput.abi;

  const bytecode = (address)
    ? linkBytecode(artifact, address)
    : artifact.compilerOutput.evm.bytecode.object;

  const options = {
    data: bytecode,
    gasPrice: '1',
    gas: 4000000,
  };

  // Deploy contract
  const contract = new web3.eth.Contract(abi, options);
  return contract.deploy().send({from: accounts[0]});
}

/**
 * Links a single libary into artifact bytecode
 * @param  {Object} artifact
 * @param  {String} address  library address
 * @return {String}          linked bytecode
 */
function linkBytecode(artifact, address){
  const bytecode = artifact.compilerOutput.evm.bytecode.object;
  const regex = new RegExp(/__\$.*?\$__/, 'g');
  bytecode = bytecode.replace(regex, address.replace("0x", ""));
  return bytecode;
}

/**
 * Await `secs` seconds
 * @param  {Number} secs seconds
 * @return {Promise}
 */
async function waitSecs(secs=0){
  return new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
}

/**
 * Derives IPFS hash of string
 * @param  {String} str
 * @return {String}     IPFS hash (ex: "Qm")
 */
async function getIPFSHash(str){
  const file = new UnixFS('file', Buffer.from(str));
  const node = new dagPB.DAGNode(file.marshal());
  const metadataLink = await node.toDAGLink()
  return multihashes.toB58String(metadataLink._cid.multihash);
}

/**
 * Extracts bzzr0 hash from a compiled artifact's deployed bytecode
 * @param  {Object} artifact artifact in ex: test/sources/pass
 * @return {String}          hash
 */
function getBzzr0Hash(artifact){
  const bytes = Web3.utils.hexToBytes(artifact.compilerOutput.evm.deployedBytecode.object);
  const data = utils.cborDecode(bytes);
  const val = Web3.utils.bytesToHex(data.bzzr0).slice(2);

  if (!val.length) throw ('Artifact does not support bzzr0');
  return val;
}

/**
 * Extracts bzzr1 hash from a compiled artifact's deployed bytecode
 * @param  {Object} artifact artifact in ex: test/sources/pass
 * @return {String}          hash
 */
function getBzzr1Hash(artifact){
  const bytes = Web3.utils.hexToBytes(artifact.compilerOutput.evm.deployedBytecode.object);
  const data = utils.cborDecode(bytes);
  const val = Web3.utils.bytesToHex(data.bzzr1).slice(2);

  if (!val.length) throw ('Artifact does not support bzzr1');
  return val;
}

module.exports = {
  deployFromArtifact: deployFromArtifact,
  waitSecs: waitSecs,
  getIPFSHash: getIPFSHash,
  getBzzr0Hash: getBzzr0Hash,
  getBzzr1Hash: getBzzr1Hash
}
