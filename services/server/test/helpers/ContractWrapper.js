const { deployFromAbiAndBytecode } = require("./helpers");
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
   * @param {Signer} signer: Signer object from ethers.js to deploy the contract
   * @param {string} from: address of the deployed account
   * @returns {strong} deployed contract address
   */
  async deploy(signer) {
    const address = await deployFromAbiAndBytecode(
      signer,
      this.artifact.compilerOutput.abi,
      this.artifact.compilerOutput.evm.bytecode.object,
      this.args
    );
    return address;
  }
}

module.exports = ContractWrapper;
