const { deployFromPrivateKey } = require("../helpers/helpers");
const Web3 = require("web3");
const ContractArtifact = require("./sources/shared/WithImmutables.json");
const { getSupportedChains } = require("@ethereum-sourcify/core");
const { program } = require("commander");

program
  .description(
    "Script to deploy Sourcify's (sourcify.dev) sample contracts with immutables"
  )
  .helpOption("-h, --help", "Output the help message.")
  .usage("--chainId=<chainId> --privateKey=<privateKey>")
  .requiredOption(
    "--chainId <chainId>",
    "Chain ID of the chain to deploy the contract. The chain must be added to services/core/sourcify-chains.ts. Also make sure to build typescript after adding the chain with `npx lerna run build`."
  )
  .requiredOption(
    "--privateKey <privateKey>",
    "Private key of the account that will deploy the contract"
  )
  .showSuggestionAfterError()
  .showHelpAfterError("(add --help for additional information)");

program.parse();
const options = program.opts();

if (require.main === module) {
  main(options.chainId, options.privateKey);
}

async function main(chainId, privateKey) {
  const chains = getSupportedChains();
  const chain = chains.find((chain) => chain.chainId == chainId);
  let web3;
  try {
    web3 = new Web3(chain.rpc[0]);
  } catch (err) {
    console.log(
      `Can't initiate a Web3 instance with the chain: ${chain}. \n\nMake sure the chainId is added to services/core/sourcify-chains.ts and built with npx lerna run build`
    );
    throw new Error(err);
  }
  const contractAddress = await deployFromPrivateKey(
    web3,
    ContractArtifact.abi,
    ContractArtifact.bytecode,
    privateKey,
    [222]
  );
  console.log(
    `Contract deployed at ${contractAddress} on the chain ${chain.name} (${chain.chainId})`
  );
}
