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
function waitSecs(secs = 0) {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}

module.exports = {
  deployFromAbiAndBytecode,
  deployFromPrivateKey,
  waitSecs,
};
