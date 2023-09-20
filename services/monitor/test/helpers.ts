import { ContractFactory, JsonRpcSigner } from "ethers";

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
