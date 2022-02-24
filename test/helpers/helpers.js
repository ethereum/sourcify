const dagPB = require("ipld-dag-pb");
const UnixFS = require("ipfs-unixfs");
const multihashes = require("multihashes");
const Web3 = require("web3");
const utils = require("../../services/core/build/utils/utils");

/**
 *  Function to deploy contracts from provider unlocked accounts
 */
async function deployFromAbiAndBytecode(web3, abi, bytecode, from, args) {
  // Deploy contract
  const contract = new web3.eth.Contract(abi);
  const deployment = contract.deploy({
    data: bytecode,
    arguments: args || [],
  });
  const gas = await deployment.estimateGas({ from });
  const contractResponse = await deployment.send({
    from,
    gas,
  });
  return contractResponse.options.address;
}

/**
 * Function to deploy contracts from an external account with private key
 */
async function deployFromPrivateKey(web3, abi, bytecode, privateKey, args) {
  const contract = new web3.eth.Contract(abi);
  const account = web3.eth.accounts.wallet.add(privateKey);
  const deployment = contract.deploy({
    data: bytecode,
    arguments: args || [],
  });
  const gas = await deployment.estimateGas({ from: account.address });
  const contractResponse = await deployment.send({
    from: account.address,
    gas,
  });
  return contractResponse.options.address;
}
/**
 * Await `secs` seconds
 * @param  {Number} secs seconds
 * @return {Promise}
 */
async function waitSecs(secs = 0) {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}

/**
 * Derives IPFS hash of string
 * @param  {String} str
 * @return {String}     IPFS hash (ex: "Qm")
 */
async function getIPFSHash(str) {
  const file = new UnixFS("file", Buffer.from(str));
  const node = new dagPB.DAGNode(file.marshal());
  const metadataLink = await node.toDAGLink();
  return multihashes.toB58String(metadataLink._cid.multihash);
}

/**
 * Extracts bzzr0 hash from a compiled artifact's deployed bytecode
 * @param  {Object} artifact artifact in ex: test/sources/pass
 * @return {String}          hash
 */
function getBzzr0Hash(artifact) {
  const bytes = Web3.utils.hexToBytes(
    artifact.compilerOutput.evm.deployedBytecode.object
  );
  const data = utils.cborDecode(bytes);
  const val = Web3.utils.bytesToHex(data.bzzr0).slice(2);

  if (!val.length) throw "Artifact does not support bzzr0";
  return val;
}

/**
 * Extracts bzzr1 hash from a compiled artifact's deployed bytecode
 * @param  {Object} artifact artifact in ex: test/sources/pass
 * @return {String}          hash
 */
function getBzzr1Hash(artifact) {
  const bytes = Web3.utils.hexToBytes(
    artifact.compilerOutput.evm.deployedBytecode.object
  );
  const data = utils.cborDecode(bytes);
  const val = Web3.utils.bytesToHex(data.bzzr1).slice(2);

  if (!val.length) throw "Artifact does not support bzzr1";
  return val;
}

module.exports = {
  deployFromAbiAndBytecode,
  deployFromPrivateKey,
  waitSecs,
  getIPFSHash,
  getBzzr0Hash,
  getBzzr1Hash,
};
