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

// Uses web3.call which does not send a tx i.e. change the state, bit simulates the tx.
async function callContractMethod(
  web3,
  abi,
  contractAddress,
  methodName,
  from,
  args
) {
  const contract = new web3.eth.Contract(abi, contractAddress);
  const method = contract.methods[methodName](...args);
  const gas = await method.estimateGas({ from });

  const callResponse = await method.call({
    from,
    gas,
  });

  return callResponse;
}

// Sends a tx that changes the state
async function callContractMethodWithTx(
  web3,
  abi,
  contractAddress,
  methodName,
  from,
  args
) {
  const contract = new web3.eth.Contract(abi, contractAddress);
  const method = contract.methods[methodName](...args);
  const gas = await method.estimateGas({ from });

  const txReceipt = await method.send({
    from,
    gas,
  });

  return txReceipt;
}

module.exports = {
  deployFromAbiAndBytecode,
  deployFromPrivateKey,
  waitSecs,
  callContractMethod,
  callContractMethodWithTx,
};
