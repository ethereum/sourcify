
/**
 * Deploys a contract to testrpc
 * @param  {Object} web3
 * @param  {Object} artifact     ex: const Simple = require('./sources/pass/simple.js');
 * @param  {String} contractName ex: "Simple.sol"
 * @param  {Array}  args         constructor args
 * @return {Web3Contract}        deployed contract instance
 */
async function deployFromArtifact(web3, artifact, args){
  const accounts = await web3.eth.getAccounts();
  const abi = artifact.compilerOutput.abi;

  args = args || [];

  const options = {
    data: artifact.compilerOutput.evm.bytecode.object,
    gasPrice: '1',
    gas: 4000000,
  };

  // Deploy contract
  const contract = new web3.eth.Contract(abi, options);
  return contract.deploy(...args).send({from: accounts[0]});
}

/**
 * Await `secs` seconds
 * @param  {Number} secs seconds
 * @return {Promise}
 */
async function waitSecs(secs=0){
  return new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
}

module.exports = {
  deployFromArtifact: deployFromArtifact,
  waitSecs: waitSecs
}
