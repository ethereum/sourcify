const { ContractFactory } = require("ethers");
const nock = require("nock");
const { expect } = require("chai");

exports.deployFromAbiAndBytecode = async (signer, abi, bytecode, args) => {
  const contractFactory = new ContractFactory(abi, bytecode, signer);
  console.log(`Deploying contract ${args?.length ? `with args ${args}` : ""}`);
  const deployment = await contractFactory.deploy(...(args || []));
  await deployment.waitForDeployment();

  const contractAddress = await deployment.getAddress();
  console.log(`Deployed contract at ${contractAddress}`);
  return contractAddress;
};

/**
 * Returns a nock scope that later can be checked with isDone() if it was called.
 *
 * I.e. check if a request to serverUrl was made with the expected chainId and address.
 */
exports.nockInterceptorForVerification = (
  serverUrl,
  expectedChainId,
  expectedAddress
) => {
  return nock(serverUrl)
    .post("/")
    .reply(function (uri, requestBody) {
      expect(requestBody.chainId).to.equal(expectedChainId.toString());
      expect(requestBody.address).to.equal(expectedAddress);
      const { address, chainId } = requestBody;
      return [200, { address, chainId, status: "perfect" }];
    });
};
