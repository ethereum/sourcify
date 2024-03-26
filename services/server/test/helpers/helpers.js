const { ContractFactory, Wallet, BaseContract } = require("ethers");
const { sourcifyChainsMap } = require("../../dist/sourcify-chains");
const {
  assertVerificationSession,
  assertVerification,
} = require("./assertions");
const chai = require("chai");
const chaiHttp = require("chai-http");
const path = require("path");
const fs = require("fs").promises;

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
  it(`Non-Session: Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${sourcifyChainsMap[chainId].etherscanApi.apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
    let request = chai
      .request(serverApp)
      .post("/verify/etherscan")
      .field("address", address)
      .field("chain", chainId);
    request.end(async (err, res) => {
      // currentResponse = res;
      await assertVerification(
        false,
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

function verifyAndAssertEtherscanSession(
  serverApp,
  chainId,
  address,
  expectedStatus,
  type
) {
  it(`Session: Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${sourcifyChainsMap[chainId].etherscanApi.apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
    chai
      .request(serverApp)
      .post("/session/verify/etherscan")
      .field("address", address)
      .field("chainId", chainId)
      .end(async (err, res) => {
        // currentResponse = res;
        await assertVerificationSession(
          false,
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

async function readFilesFromDirectory(dirPath) {
  try {
    const filesContent = {};
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const content = await fs.readFile(filePath, "utf8");
        filesContent[file] = content;
      }
    }
    return filesContent;
  } catch (error) {
    console.error("Error reading files from directory:", error);
    throw error;
  }
}

async function resetDatabase(storageService) {
  await storageService.sourcifyDatabase.init();
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM sourcify_sync"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM sourcify_matches"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM verified_contracts"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM contract_deployments"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM compiled_contracts"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM contracts"
  );
  await storageService.sourcifyDatabase.databasePool.query("DELETE FROM code");
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
  readFilesFromDirectory,
  resetDatabase,
};
