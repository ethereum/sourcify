import {
  ContractFactory,
  Wallet,
  JsonRpcSigner,
  Interface,
  InterfaceAbi,
  JsonRpcProvider,
  BytesLike,
  Contract,
} from "ethers";
import { sourcifyChainsMap } from "../../src/sourcify-chains";
import { assertVerificationSession, assertVerification } from "./assertions";
import chai from "chai";
import chaiHttp from "chai-http";
import path from "path";
import { promises as fs } from "fs";
import { StorageService } from "../../src/server/services/StorageService";

chai.use(chaiHttp);

export const invalidAddress = "0x000000bCB92160f8B7E094998Af6BCaD7fa537ff"; // checksum false
export const unusedAddress = "0xf1Df8172F308e0D47D0E5f9521a5210467408535";
export const unsupportedChain = "3"; // Ropsten

export async function deployFromAbiAndBytecode(
  signer: JsonRpcSigner,
  abi: Interface | InterfaceAbi,
  bytecode: BytesLike | { object: string },
  args?: any[]
) {
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
export async function deployFromAbiAndBytecodeForCreatorTxHash(
  signer: JsonRpcSigner,
  abi: Interface | InterfaceAbi,
  bytecode: BytesLike | { object: string },
  args?: any[]
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
export async function deployFromPrivateKey(
  provider: JsonRpcProvider,
  abi: Interface | InterfaceAbi,
  bytecode: BytesLike | { object: string },
  privateKey: string,
  args?: any[]
) {
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
export function waitSecs(secs = 0) {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}

// Uses staticCall which does not send a tx i.e. change the state.
export async function callContractMethod(
  provider: JsonRpcProvider,
  abi: Interface | InterfaceAbi,
  contractAddress: string,
  methodName: string,
  args: any[]
) {
  const contract = new Contract(contractAddress, abi, provider);
  const callResponse = await contract[methodName].staticCall(...args);

  return callResponse;
}

// Sends a tx that changes the state
export async function callContractMethodWithTx(
  signer: JsonRpcSigner,
  abi: Interface | InterfaceAbi,
  contractAddress: string,
  methodName: string,
  args: any[]
) {
  const contract = new Contract(contractAddress, abi, signer);
  const txResponse = await contract[methodName].send(...args);
  const txReceipt = await txResponse.wait();
  return txReceipt;
}

export function verifyAndAssertEtherscan(
  serverApp: Express.Application,
  chainId: string,
  address: string,
  expectedStatus: string,
  type: string
) {
  it(`Non-Session: Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${sourcifyChainsMap[chainId].etherscanApi?.apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
    const request = chai
      .request(serverApp)
      .post("/verify/etherscan")
      .field("address", address)
      .field("chain", chainId);
    request.end(async (err, res) => {
      await assertVerification(
        null,
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

export function verifyAndAssertEtherscanSession(
  serverApp: Express.Application,
  chainId: string,
  address: string,
  expectedStatus: string,
  type: string
) {
  it(`Session: Should import a ${type} contract from  #${chainId} ${sourcifyChainsMap[chainId].name} (${sourcifyChainsMap[chainId].etherscanApi?.apiURL}) and verify the contract, finding a ${expectedStatus} match`, (done) => {
    chai
      .request(serverApp)
      .post("/session/verify/etherscan")
      .field("address", address)
      .field("chainId", chainId)
      .end(async (err, res) => {
        await assertVerificationSession(
          null,
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

export async function readFilesFromDirectory(dirPath: string) {
  try {
    const filesContent: Record<string, string> = {};
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

export async function resetDatabase(storageService: StorageService) {
  if (!storageService.sourcifyDatabase) {
    chai.assert.fail("No database on StorageService");
  }
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
    "DELETE FROM compiled_contracts_new"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM contracts"
  );
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM contracts_new"
  );
  await storageService.sourcifyDatabase.databasePool.query("DELETE FROM code");
  await storageService.sourcifyDatabase.databasePool.query(
    "DELETE FROM code_new"
  );
}
