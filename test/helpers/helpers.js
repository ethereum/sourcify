const { etherscanAPIs } = require("../../dist/config");
const { sourcifyChainsMap } = require("../../dist/sourcify-chains");
const {
  assertVerificationSession,
  assertVerification,
} = require("./assertions");
const chai = require("chai");
const chaiHttp = require("chai-http");

chai.use(chaiHttp);

const invalidAddress = "0x000000bCB92160f8B7E094998Af6BCaD7fa537ff"; // checksum false
const unusedAddress = "0xf1Df8172F308e0D47D0E5f9521a5210467408535";
const unsupportedChain = "3"; // Ropsten
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
 * Creator tx hash is needed for tests. This function returns the tx hash in addition to the contract address.
 *
 * @returns The contract address and the tx hash
 */
async function deployFromAbiAndBytecodeForCreatorTxHash(
  web3,
  abi,
  bytecode,
  from,
  args
) {
  // Deploy contract
  const contract = new web3.eth.Contract(abi);
  const deployment = contract.deploy({
    data: bytecode,
    arguments: args || [],
  });
  const gas = await deployment.estimateGas({ from });

  // If awaited, the send() Promise returns the contract instance.
  // We also need the tx hash so we need two seperate event listeners.
  const sendPromiEvent = deployment.send({
    from,
    gas,
  });

  const txHashPromise = new Promise((resolve, reject) => {
    sendPromiEvent.on("transactionHash", (txHash) => {
      resolve(txHash);
    });
    sendPromiEvent.on("error", (error) => {
      reject(error);
    });
  });

  const contractAddressPromise = new Promise((resolve, reject) => {
    sendPromiEvent.on("receipt", (receipt) => {
      if (!receipt.contractAddress) {
        reject(new Error("No contract address in receipt"));
      } else {
        resolve(receipt.contractAddress);
      }
    });
    sendPromiEvent.on("error", (error) => {
      reject(error);
    });
  });

  return Promise.all([contractAddressPromise, txHashPromise]);
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

function verifyAndAssertEtherscan(
  serverApp,
  chainId,
  address,
  expectedStatus,
  type
) {
  it(`Non-Session: Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${etherscanAPIs[chainId].apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
    let request = chai
      .request(serverApp)
      .post("/verify/etherscan")
      .field("address", address)
      .field("chain", chainId);
    request.end((err, res) => {
      // currentResponse = res;
      assertVerification(err, res, done, address, chainId, expectedStatus);
    });
  });
}

function verifyAndAssertEtherscanSession(
  serverApp,
  chainId,
  address,
  expectedStatus,
  type
) {
  it(`Session: Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${etherscanAPIs[chainId].apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
    chai
      .request(serverApp)
      .post("/session/verify/etherscan")
      .field("address", address)
      .field("chainId", chainId)
      .end((err, res) => {
        // currentResponse = res;
        assertVerificationSession(
          err,
          res,
          done,
          address,
          chainId,
          expectedStatus
        );
      });
  });
}

module.exports = {
  deployFromAbiAndBytecode,
  deployFromAbiAndBytecodeForCreatorTxHash,
  deployFromPrivateKey,
  waitSecs,
  callContractMethod,
  callContractMethodWithTx,
  invalidAddress,
  unsupportedChain,
  unusedAddress,
  verifyAndAssertEtherscan,
  verifyAndAssertEtherscanSession,
};
