const { ContractFactory, Wallet, BaseContract } = require("ethers");
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

async function deployFromAbiAndBytecode(signer, abi, bytecode, args) {
  const contractFactory = new ContractFactory(abi, bytecode, signer);
  console.log(`Deploying contract ${args?.length ? `with args ${args}` : ""}`);
  const deployment = await contractFactory.deploy(...(args || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  console.log(`Deployed contract at ${contractAddress}`);
  return contractAddress;
}

/**
 * Creator tx hash is needed for tests. This function returns the tx hash in addition to the contract address.
 *
 */
async function deployFromAbiAndBytecodeForCreatorTxHash(
  signer,
  abi,
  bytecode,
  args
) {
  const contractFactory = new ContractFactory(abi, bytecode, signer);
  console.log(`Deploying contract ${args?.length ? `with args ${args}` : ""}`);
  const deployment = await contractFactory.deploy(...(args || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  const creationTx = deployment.deploymentTransaction();
  if (!creationTx) {
    throw new Error(`No deployment transaction found for ${contractAddress}`);
  }
  console.log(
    `Deployed contract at ${contractAddress} with tx ${creationTx.hash}`
  );

  return { contractAddress, txHash: creationTx.hash };
}
/**
 * Function to deploy contracts from an external account with private key
 */
async function deployFromPrivateKey(provider, abi, bytecode, privateKey, args) {
  const signer = new Wallet(privateKey, provider);
  const contractFactory = new ContractFactory(abi, bytecode, signer);
  console.log(`Deploying contract ${args?.length ? `with args ${args}` : ""}`);
  const deployment = await contractFactory.deploy(...(args || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  console.log(`Deployed contract at ${contractAddress}`);
  return contractAddress;
}

/**
 * Await `secs` seconds
 * @param  {Number} secs seconds
 * @return {Promise}
 */
function waitSecs(secs = 0) {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}

// Uses staticCall which does not send a tx i.e. change the state.
async function callContractMethod(
  provider,
  abi,
  contractAddress,
  methodName,
  from,
  args
) {
  const contract = new BaseContract(contractAddress, abi, provider);
  const callResponse = await contract[methodName].staticCall(...args);

  return callResponse;
}

// Sends a tx that changes the state
async function callContractMethodWithTx(
  signer,
  abi,
  contractAddress,
  methodName,
  args
) {
  const contract = new BaseContract(contractAddress, abi, signer);
  const txResponse = await contract[methodName].send(...args);
  const txReceipt = await txResponse.wait();
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
