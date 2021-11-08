import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import dotenv from "dotenv";
import path from "path";
import ContractCallDecoder from "../build/index.js";
import * as expected from "./expected.js";
import { metadata1, metadata3, metadata4 } from "./metadata.js";
import QmRFjbs2fEEQnAKaZzZKqWArJTta76GaWsD4PRbHuoY41S from "./QmRFjbs2fEEQnAKaZzZKqWArJTta76GaWsD4PRbHuoY41S.js";
dotenv.config({ path: path.resolve("./test/.env") }); // Tests called from project root
chai.use(chaiAsPromised);

describe("Contract Call Decoder", function () {
  let simpleDecoder = new ContractCallDecoder();

  // this.beforeAll(() => {
  //   simpleDecoder =
  // });

  it("should extract the IPFS hash from the bytecode", async () => {
    const byteCode =
      "0x608060405234801561001057600080fd5b506004361061004c5760003560e01c80637bd703e81461005157806390b98a11146100a957806396e4ee3d1461010f578063f8b2cb4f1461015b575b600080fd5b6100936004803603602081101561006757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506101b3565b6040518082815260200191505060405180910390f35b6100f5600480360360408110156100bf57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506101cf565b604051808215151515815260200191505060405180910390f35b6101456004803603604081101561012557600080fd5b810190808035906020019092919080359060200190929190505050610328565b6040518082815260200191505060405180910390f35b61019d6004803603602081101561017157600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610335565b6040518082815260200191505060405180910390f35b60006101c86101c183610335565b6002610328565b9050919050565b6000816000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410156102205760009050610322565b816000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282540392505081905550816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190505b92915050565b6000818302905092915050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905091905056fea2646970667358221220711ac087831068bd33b58ebff95a8cdb23734e3a7a5c3c30fdb0d01e2b73c1ae64736f6c63430006020033";
    const expectedIpfsHash = {
      origin: "ipfs",
      hash: "QmVxASRDQqUpxSvipxzHmnN2CqXjXvEDKGUTJn7ss9ioM7",
    };
    const resultedIpfsHash = ContractCallDecoder.decodeMetadataHash(byteCode);
    chai.expect(resultedIpfsHash).to.deep.equal(expectedIpfsHash);
  });

  describe("Fetching from IPFS", () => {
    it("should fetch the metadata file from IPFS", async () => {
      const metadataHash = {
        origin: "ipfs",
        hash: "QmRFjbs2fEEQnAKaZzZKqWArJTta76GaWsD4PRbHuoY41S",
      };
      const expectedOutput = QmRFjbs2fEEQnAKaZzZKqWArJTta76GaWsD4PRbHuoY41S;
      const metadata = await simpleDecoder.fetchMetadataWithHash(metadataHash);
      chai.expect(expectedOutput).to.deep.equal(metadata);
    }).timeout(5000);

    it("should fail to fetch incorrect metadata hash from IPFS", async () => {
      const metadataHash = "abcdef";
      return chai
        .expect(simpleDecoder.fetchMetadataWithHash(metadataHash))
        .be.rejectedWith(Error);
    });

    it("should timeout to fetch non-existent hash from IPFS in 5sec", async () => {
      const metadataHash = {
        origin: "ipfs",
        hash: "QmRFjbs2fEEQnAKaZzZKqWArJTta76GaWsD4PRbHuoY4as",
      };
      const timeoutDecoder = new ContractCallDecoder(
        undefined,
        undefined,
        5000
      );
      return chai
        .expect(timeoutDecoder.fetchMetadataWithHash(metadataHash))
        .be.rejectedWith(Error);
    }).timeout(10000);
  });

  describe("mint(address,uint256) function", () => {
    let tx, output;
    this.beforeAll(async () => {
      tx = {
        input:
          "0x40c10f19000000000000000000000000aa6042aa65eb93c6439cdaebc27b3bd09c5dfe940000000000000000000000000000000000000000000000000de0b6b3a7640000",
      };
      output = await simpleDecoder.decodeDocumentation(tx, metadata1.output);
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

  describe("approve(address,uint256) function ", () => {
    let tx, output;

    this.beforeAll(async () => {
      tx = {
        input:
          "0x095ea7b3000000000000000000000000a3176119b2166b021fc2eb5f47b86a8ac641dc90ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      };
      output = await simpleDecoder.decodeDocumentation(tx, metadata1.output);
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

  // Tx 0x14e8058b6335521567eed31eae07afd50875939b42c326a9ec7a3a8d13a50556 on Rinkeby
  describe("transfer(address,uint256) function", () => {
    let tx, output;

    this.beforeAll(async () => {
      tx = {
        from: "0x5a14d695c6e2cf9c9bec4472604267acef7b652e",
        to: "0x1d08eb247554a3c8ddb29b7313aa8b961b5f87a6",
        input:
          "0xa9059cbb000000000000000000000000e89546063d995dfc96d719e4ff533e82a02dbb8800000000000000000000000000000000000000000000006c6b935b8bbd400000",
      };
      output = await simpleDecoder.decodeDocumentation(tx, metadata3.output);
    });

    it("should replace `msg.sender` and `dst` in userdoc but not replace incorrect `amount`.", () => {
      // actualy parameter of func. is 'rawAmount' but @notice has `amount`.
      const expectedUserdoc =
        "Transfer `amount` tokens from 0x5A14D695C6e2cF9C9Bec4472604267acEF7B652e to 0xE89546063D995dFC96D719e4FF533e82A02dBb88";
      chai.expect(output.userdoc.notice).to.equal(expectedUserdoc);
    });
  });

  // Tx 0x559d2102087c96e09d6da278eea394187c1bb3ada2853766e83cad7e567c33b8 in Rinkeby
  describe("setFulfillmentPermission(address,bool) function", () => {
    let tx, output;
    this.beforeAll(async () => {
      tx = {
        from: "0x0a6be7ef9def0025bd75a7ea8bc661a143235ed7",
        input:
          "0x7fcd56db0000000000000000000000005b0c7b3c536ea45ba709224c966ca11afcf00b9a0000000000000000000000000000000000000000000000000000000000000001",
        to: "0x98977330d7b19bc260de0adb748876e3bc030c48",
      };
      output = await simpleDecoder.decodeDocumentation(tx, metadata4.output);
    });

    it("should not throw when parameters in ticks are not found but write what's found in docs e.g. `true`", async () => {
      it("should replace `msg.sender` in userdoc ", () => {
        const expectedUserdoc =
          "Sets the fulfillment permission for a given node. Use `true` to allow, `false` to disallow.";
        chai.expect(output.userdoc.notice).to.equal(expectedUserdoc);
      });
    });
  });

  describe("#fetchDeployedByteCode()", () => {
    let decoder, noBytecodeAddress, contractAddress;
    this.beforeAll(() => {
      decoder = new ContractCallDecoder(process.env.RINKEBY_RPC);
      noBytecodeAddress = "0x8b48d9908a80508a7aa5900008ab176987f418e2";
      contractAddress = "0x749da5a21557accbac2dfaca5aa16fe6e7d39a96";
    });
    it("should throw an exception error, if address isn't provided", async () => {
      return chai
        .expect(decoder.fetchDeployedByteCode(""))
        .rejectedWith(Error, "No contract address defined.");
    });

    it("should throw an exception error, if address format is wrong", async () => {
      return chai
        .expect(
          decoder.fetchDeployedByteCode(
            "0x2aa760e35c24510f82b831a1b4da6fb891741f4df868f86723c747b22cd76b33"
          )
        )
        .rejectedWith(
          Error,
          "Invalid 'address' parameter '0x2aa760e35c24510f82b831a1b4da6fb891741f4df868f86723c747b22cd76b33'"
        );
    });

    it("should throw an error, if not a contract", async () => {
      return chai
        .expect(decoder.fetchDeployedByteCode(noBytecodeAddress))
        .rejectedWith(Error, `No bytecode found at ${noBytecodeAddress}`);
    });

    it("should retrieve deployed bytcode from Rinkeby 0x749da5a21557accbac2dfaca5aa16fe6e7d39a96", async () => {
      const byteCode = await decoder.fetchDeployedByteCode(contractAddress);
      chai.expect(expected.deployedBytecode).to.equal(byteCode);
    });
  });

  describe("Full Functionality", () => {
    it("Should decode Rinkeby tx with hash 0xa7a84bd023700d8bec5aa5e644681c64e2b27e7e186f7c91f2c0d640e4e2fa62", async () => {
      const decoder = new ContractCallDecoder(process.env.RINKEBY_RPC);
      const tx = {
        input:
          "0x23b872dd0000000000000000000000001dd5682f664a1402bf7d89ae346cbdd786244f42000000000000000000000000d1cd6444c222898e82964fcdf3ec152aa58b06560000000000000000000000000000000000000000000000000000000000002715",
        from: "0x1dD5682F664A1402BF7d89Ae346cbDd786244F42",
        to: "0x6b1ee6618e4237d39f1afbb8d196e39fbbc6deac",
      };
      const documentation = await decoder.decode(tx);
      chai.expect(expected.expectedDocumentation1).deep.equal(documentation);
    }).timeout(5000); // IPFS fetch takes long

    it("Should decode Rinkeby tx with hash 0x78ff128ef23b742db84905cd13616fa114ae6bbf8067c40875ff76a353e6fba7", async () => {
      const decoder = new ContractCallDecoder(process.env.RINKEBY_RPC);
      const tx = {
        input:
          "0xa9059cbb000000000000000000000000e8fd6e7e759f33ea9bda1151667de7cb7e7454ad00000000000000000000000000000000000000000000003635c9adc5dea00000",
        to: "0x1d08eb247554a3c8ddb29b7313aa8b961b5f87a6",
        from: "0xa0c378a0925b5289912bf5d8a6ce3a55a90fff92",
      };
      const documentation = await decoder.decode(tx);
      chai.expect(expected.expectedDocumentation2).deep.equal(documentation);
    }).timeout(5000); // IPFS fetch takes long
  });
});
