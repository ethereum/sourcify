import { ContractFactory, JsonRpcSigner } from "ethers";
// Use nock because sinon can only intercept XMLHttpRequests, which nodejs does not use
import nock from "nock";
import { expect } from "chai";

export const deployFromAbiAndBytecode = async (
  signer: JsonRpcSigner,
  abi: any,
  bytecode: string,
  args: any
) => {
  const contractFactory = new ContractFactory(abi, bytecode, signer);
  console.log(`Deploying contract ${args?.length ? `with args ${args}` : ""}`);
  const deployment = await contractFactory.deploy(...(args || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  console.log(`Deployed contract at ${contractAddress}`);
  return contractAddress;
};

// Returns a nock scope that later can be checked with isDone() if it was called.
export const nockInterceptorForVerification = (
  serverUrl: string,
  expectedChainId: number,
  expectedAddress: string
) => {
  return nock(serverUrl)
    .post("/")
    .reply(function (uri, requestBody: any) {
      expect(requestBody.chainId).to.equal(expectedChainId.toString());
      expect(requestBody.address).to.equal(expectedAddress);
      const { address, chainId } = requestBody;
      return [200, { address, chainId, status: "perfect" }];
    });
};
