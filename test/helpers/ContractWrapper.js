const { deployFromAbiAndBytecode } = require("./helpers");
const Web3EthAbi = require("web3-eth-abi");
/**
 * Wrapper class for the 0x/sol-compiler's contract compilation artifacts.
 * @param artifactObject: The compilation artifact as JSON
 * @param publishOptions: { metadata: boolean, sources: boolean } if metadata and sources should be published upon `this.publish()` or not
 * @param args: constructor arguments
 */
class ContractWrapper {
  constructor(artifactObject, publishOptions, args = []) {
    this.artifact = artifactObject;
    this.rawMetadata = this.artifact.compilerOutput.metadata;
    this.metadata = JSON.parse(this.rawMetadata);
    this.sources = this.artifact.sourceCodes;
    this.publishOptions = publishOptions;
    this.args = args;

    if (args.length) {
      this.constructArgsHex();
    }
  }

  constructArgsHex() {
    let ctorSpecInput;
    for (const methodSpec of this.artifact.compilerOutput.abi) {
      if (methodSpec.type === "constructor") {
        ctorSpecInput = methodSpec.inputs;
      }
    }

    this.argsHex = Web3EthAbi.encodeParameters(ctorSpecInput, this.args);
  }

  async publish(ipfsNode) {
    if (this.publishOptions.metadata) {
      this.metadataIpfsHash = (await ipfsNode.add(this.rawMetadata)).path;
    }

    if (this.publishOptions.sources) {
      for (const sourceName in this.sources) {
        await ipfsNode.add(this.sources[sourceName]);
      }
    }
  }

  /**
   *
   * @param {Web3} web3Provider: Web3 provider of the network the contract will be deployed at
   * @param {string} from: address of the deployed account
   * @returns {strong} deployed contract address
   */
  async deploy(web3Provider, from) {
    const address = await deployFromAbiAndBytecode(
      web3Provider,
      this.artifact.compilerOutput.abi,
      this.artifact.compilerOutput.evm.bytecode.object,
      from,
      this.args
    );
    console.log("Deployed contract at " + address);
    return address;
  }
}

module.exports = ContractWrapper;
