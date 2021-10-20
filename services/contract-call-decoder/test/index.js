import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import ContractCallDecoder from "../build/index.js";
import metadata from "./metadata.js";

chai.use(chaiAsPromised);

describe("Contract Call Decoder", function () {
  const simpleDecoder = new ContractCallDecoder();

  it("should extract the IPFS hash from the bytecode", async () => {
    const byteCode =
      "0x608060405234801561001057600080fd5b506004361061004c5760003560e01c80637bd703e81461005157806390b98a11146100a957806396e4ee3d1461010f578063f8b2cb4f1461015b575b600080fd5b6100936004803603602081101561006757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506101b3565b6040518082815260200191505060405180910390f35b6100f5600480360360408110156100bf57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506101cf565b604051808215151515815260200191505060405180910390f35b6101456004803603604081101561012557600080fd5b810190808035906020019092919080359060200190929190505050610328565b6040518082815260200191505060405180910390f35b61019d6004803603602081101561017157600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610335565b6040518082815260200191505060405180910390f35b60006101c86101c183610335565b6002610328565b9050919050565b6000816000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410156102205760009050610322565b816000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282540392505081905550816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190505b92915050565b6000818302905092915050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905091905056fea2646970667358221220711ac087831068bd33b58ebff95a8cdb23734e3a7a5c3c30fdb0d01e2b73c1ae64736f6c63430006020033";
    const expectedIpfsHash = "QmVxASRDQqUpxSvipxzHmnN2CqXjXvEDKGUTJn7ss9ioM7";
    const resultedIpfsHash = await ContractCallDecoder.decodeMetadataHash(
      byteCode
    );
    chai.expect(resultedIpfsHash).to.equal(expectedIpfsHash);
  });

  describe("mint(address,uint256) function", () => {
    let inputData, output;
    this.beforeAll(async () => {
      inputData =
        "0x40c10f19000000000000000000000000aa6042aa65eb93c6439cdaebc27b3bd09c5dfe940000000000000000000000000000000000000000000000000de0b6b3a7640000";
      output = await simpleDecoder.decodeDocumentation(
        inputData,
        metadata.output
      );
    });

    // Tests
    it("should generate a parsed and replaced userdoc NatSpec", () => {
      const expectedUserdocMsg =
        "Creates 1000000000000000000 token to 0xAA6042aa65eb93C6439cDaeBC27B3bd09c5DFe94. Must only be called by the owner (MasterChef).";
      chai.expect(output.userdoc.notice).to.equal(expectedUserdocMsg);
    });

    it("should return an undefined devdoc if the function is not in devdoc", () => {
      const expectedDevdoc = undefined;
      chai.expect(output.devdoc).to.equal(expectedDevdoc);
    });

    it("should extract function name correctly", () => {
      const expectedName = "mint";
      chai.expect(output.functionName).to.equal(expectedName);
    });

    it("should extract parameters correctly", () => {
      const expectedParams = [
        {
          name: "_to",
          type: "address",
          value: "0xAA6042aa65eb93C6439cDaeBC27B3bd09c5DFe94",
        },
        { name: "_amount", type: "uint256", value: "1000000000000000000" },
      ];
      chai.expect(output.params).to.deep.equal(expectedParams);
    });
  });

  describe("approve(address,uint256) function", () => {
    let inputData, output;

    this.beforeAll(async () => {
      inputData =
        "0x095ea7b3000000000000000000000000a3176119b2166b021fc2eb5f47b86a8ac641dc90ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      output = await simpleDecoder.decodeDocumentation(
        inputData,
        metadata.output
      );
    });

    // Tests
    it("should generate a parsed and replaced devdoc NatSpec for approve function", () => {
      const expectedDevdocMsg =
        "See {IERC20-approve}. Requirements: - 0xA3176119b2166b021fc2eb5f47b86A8Ac641dC90 cannot be the zero address.";
      chai.expect(output.devdoc.details).to.equal(expectedDevdocMsg);
    });

    it("should return an undefined userdoc if the function is not in userdoc", () => {
      const expectedUserdoc = undefined;
      chai.expect(output.userdoc).to.equal(expectedUserdoc);
    });

    it("should extract function name correctly", () => {
      const expectedName = "approve";
      chai.expect(output.functionName).to.equal(expectedName);
    });

    it("should extract parameters correctly", () => {
      const expectedParams = [
        {
          name: "spender",
          type: "address",
          value: "0xA3176119b2166b021fc2eb5f47b86A8Ac641dC90",
        },
        {
          name: "amount",
          type: "uint256",
          value:
            "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        },
      ];
      chai.expect(output.params).to.deep.equal(expectedParams);
    });
  });
});
