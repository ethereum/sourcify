import Web3 from 'web3';

/**
 *  Function to deploy contracts from provider unlocked accounts
 */
// TODO: ABI type definition
export async function deployFromAbiAndBytecode(
  web3: Web3,
  abi: any,
  bytecode: string,
  from: string,
  args?: any[]
) {
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
