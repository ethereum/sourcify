// set env vars before Server init
process.env.MOCK_REPOSITORY = "./mockRepository";
process.env.MOCK_DATABASE = "./database";
process.env.TESTING = "true";

const chai = require("chai");
const chaiHttp = require("chai-http");
const Server = require("../../dist/server/server").Server;
const fs = require("fs");
const path = require("path");
const util = require("util");
const rimraf = require("rimraf");
const StatusCodes = require("http-status-codes").StatusCodes;
const ethers = require("ethers");

const TEST_TIME = 30000; // 30 seconds

// Extract the chainId from new network support pull request, if exists
const newAddedChainId = process.env.NEW_CHAIN_ID;
console.log("newAddedChainId");
console.log(newAddedChainId);

chai.use(chaiHttp);

describe("Test Supported Networks", function () {
  this.timeout(TEST_TIME);
  const server = new Server();

  before(async function () {
    const promisified = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Injector listening on port ${server.port}!`);
  });

  beforeEach(() => {
    rimraf.sync(server.repository);
  });

  after(() => {
    rimraf.sync(server.repository);
  });

  verifyContract(
    "0x801f3983c7baBF5E6ae192c84E1257844aDb4b4D",
    "1",
    "Ethereum Mainnet",
    ["1/airdrop.sol", "1/IERC20.sol"],
    "1/metadata.json"
  );

  verifyContractWithImmutables(
    "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
    "3",
    "Ropsten",
    ["uint256"],
    [987],
    ["shared/WithImmutables.sol"],
    "shared/old.withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0x656d0062eC89c940213E3F3170EA8b2add1c0143",
    "4",
    "Rinkeby",
    ["uint256"],
    [101],
    ["shared/WithImmutables.sol"],
    "shared/old.withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0xBdDe4D595F2CDdA92ca274423374E0e1C7286426",
    "5",
    "Goerli",
    ["uint256"],
    [2],
    ["shared/WithImmutables.sol"],
    "shared/old.withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0x443C64AcC4c6dB358Eb1CA78fdf7577C2a7eA499",
    "42",
    "Kovan",
    ["uint256"],
    [256],
    ["shared/WithImmutables.sol"],
    "shared/old.withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0x3CE1a25376223695284edc4C2b323C3007010C94",
    "100",
    "xDai",
    ["uint256"],
    [123],
    ["shared/WithImmutables.sol"],
    "shared/old.withImmutables.metadata.json"
  );

  verifyContract(
    "0xED5405Ba038587c06979374f8a595F41F5841216",
    "56",
    "Binance Smart Chain Mainnet",
    ["56/Index.sol"],
    "56/metadata.json"
  );
  describe("Celo Alfajores Testnet", function () {
    verifyContract(
      "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
      "44787",
      "Celo Alfajores Testnet",
      ["shared/Storage.sol"],
      "shared/Storage_metadata.json"
    );
    verifyContractWithImmutables(
      "0x66ec3fBf4D7d7B7483Ae4fBeaBDD6022037bfa1a",
      "44787",
      "Celo Alfajores Testnet",
      ["uint256"],
      [777],
      ["shared/WithImmutables.sol"],
      "shared/old.withImmutables.metadata.json"
    );
  });

  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "97",
    "Binance Smart Chain Testnet",
    ["uint256"],
    [111],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0xEb30853fc616Bbb8f1444451A3c202cbcd08Fb47",
    "137",
    "Polygon (Matic)",
    ["address", "address"],
    [
      "0x35298453c615cd349941ecf54873708538966f7d",
      "0x4e56fe4805c21b5347bfb08787fd3e787eb59d7b",
    ],
    ["137/StakingWarmup.sol"],
    "137/metadata.json"
  );
  verifyContractWithImmutables(
    "0x9f055673EDf939c29907421d849f4D0f908DE8a7",
    "80001",
    "Polygon Mumbai Testnet",
    ["uint256"],
    [222],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0x1B18B4A3A3d5535CA5D68b7Ea969676B8Fc76bDC",
    "42220",
    "Celo Mainnet",
    ["address", "address"],
    [
      "0xA02F4e8dE9A226E8f2F2fe27B9b207fC85CFEED2",
      "0xE685d21b7B0FC7A248a6A8E03b8Db22d013Aa2eE",
    ],
    ["42220/StakingHelper.sol"],
    "42220/metadata.json"
  );

  describe("Celo Baklava Testnet", function () {
    verifyContract(
      "0xdd5FFA1DF887D5A42931a746BaAd62574501A5Aa",
      "62320",
      "Celo Baklava Testnet",
      ["62320/0xdd5FFA1DF887D5A42931a746BaAd62574501A5Aa/AVA.sol"],
      "62320/0xdd5FFA1DF887D5A42931a746BaAd62574501A5Aa/metadata.json"
    );
    verifyContractWithImmutables(
      "0x3908Eed8941D7fE3b047Ad531C7d4d1a0D628F5e",
      "62320",
      "Celo Baklava Testnet",
      ["address", "bytes32"],
      [
        "0xddc9be57f553fe75752d61606b94cbd7e0264ef8",
        "0x343f066577633aea3125817c1a919d1af0540bfd6812165ee18954fff9cf648e",
      ],
      [
        "62320/0x3908Eed8941D7fE3b047Ad531C7d4d1a0D628F5e/IERC20.sol",
        "62320/0x3908Eed8941D7fE3b047Ad531C7d4d1a0D628F5e/MerkleProof.sol",
        "62320/0x3908Eed8941D7fE3b047Ad531C7d4d1a0D628F5e/IMerkleDistributor.sol",
        "62320/0x3908Eed8941D7fE3b047Ad531C7d4d1a0D628F5e/MerkleDistributor.sol",
      ],
      "62320/0x3908Eed8941D7fE3b047Ad531C7d4d1a0D628F5e/metadata.json"
    );
  });

  verifyContractWithImmutables(
    "0x71dAE4788fD0Ef1f50a53380bD514FBf2fB647f6",
    "43114",
    "Avalanche Mainnet",
    ["address", "address"],
    [
      "0x63b527F4f9cAB808b0178282bC1036d4bBe54a45",
      "0xd6C5BFa9FeEA5579498EA4b04Fff86A9eB3A1a9d",
    ],
    ["43114/StakingHelper.sol"],
    "43114/metadata.json"
  );

  verifyContractWithImmutables(
    "0x6C367468a828C694ab2E8512a440dD50b37B6867",
    "43113",
    "Avalanche Fuji Testnet",
    ["uint256"],
    [222],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "41",
    "Telos EVM Testnet",
    ["uint256"],
    [222],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContractWithImmutables(
    "0x4c09368a4bccD1675F276D640A0405Efa9CD4944",
    "40",
    "Telos EVM Mainnet",
    ["address", "address", "uint256"],
    [
      "0x6f0342157d8cdaa66aa5161b341f23d6ef6d39a8",
      "0x7d7e1df7581fc4a39832a16d7ac873d40f875402",
      1646428630,
    ],
    [
      "40/Address.sol",
      "40/IERC20.sol",
      "40/SafeERC20.sol",
      "40/TokenTimelock.sol",
    ],
    "40/metadata.json"
  );
  verifyContractWithImmutables(
    "0xD222286c59c0B9c8D06Bac42AfB7B8CB153e7Bf7",
    "77",
    "Sokol",
    ["uint256"],
    [1234],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  verifyContractWithImmutables(
    "0x84d9eF98bF8a66bfB6ed8383F340C402507CfC15",
    "421611",
    "Arbitrum Rinkeby",
    ["uint256"],
    [42],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  verifyContractWithImmutables(
    "0x0bb3F43533FBf16d69dBdccf6AaAef81acd76FAB",
    "42161",
    "Arbitrum Mainnet",
    ["address", "address"],
    [
      "0x89832e0dbe3600a7358f2e3ea2d7af5dc7d76e0c",
      "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    ],
    ["42161/crowdsale.sol"],
    "42161/metadata.json"
  );
  verifyContract(
    "0xA25b72DADEB96E166D1a225C61b54CA29C45EBD1",
    "8",
    "Ubiq",
    ["8/GameItem.sol"],
    "8/GameItem.json"
  );
  verifyContract(
    "0x34eC0cBd5E33e7323324333434fe978f1000d9cd",
    "4216137055",
    "OneLedger Frankenstein Testnet",
    ["4216137055/SigmaToken.sol"],
    "4216137055/SigmaToken.json"
  );

  // Has contracts to be fetched from IPFS
  verifyContract(
    "0xB2d0641fc8863514B6533b129fD744200eE17D29",
    "57",
    "Syscoin Mainnet",
    ["57/Token.sol"],
    "57/TestToken.json"
  );

  // Has contracts to be fetched from IPFS
  verifyContract(
    "0xB2d0641fc8863514B6533b129fD744200eE17D29",
    "57",
    "Syscoin Tanenbaum Testnet",
    ["57/Token.sol"],
    "57/TestToken.json"
  );

  verifyContractWithImmutables(
    "0x271901c3268D0959bbc9543DE4f073D3708C88F7",
    "10",
    "Optimism Mainnet",
    ["address", "address"],
    [
      "0xa54074b2cc0e96a43048d4a68472f7f046ac0da8",
      "0x4200000000000000000000000000000000000007",
    ],
    [
      "10/iOVM_CrossDomainMessenger.sol",
      "10/ITreasury.sol",
      "10/OptimisticTreasury.sol",
      "10/Proprietor.sol",
    ],
    "10/metadata.json"
  );
  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "69",
    "Optimism Kovan Testnet",
    ["uint256"],
    [123456],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  verifyContractWithImmutables(
    "0x668E7f4d8051511279d3BD6d6854e7D39cc94873",
    "288",
    "Boba Network",
    ["address", "address", "address"],
    [
      "0x2f2f9460500f27db68aafbfa0472ceddb168a5a6",
      "0x3a60a76acae8feec74d6b5b665d4dbaab2abc406",
      "0xff133a6d335b50bdaa6612d19e1352b049a8ae6a",
    ],
    ["288/DODOV2RouteHelper.sol"],
    "288/metadata.json"
  );
  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "28",
    "Boba Network Rinkeby Testnet",
    ["uint256"],
    [666],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  verifyContract(
    "0xd8A08AFf1B0585Cad0E173Ce0E93551Ac59D3530",
    "106",
    "Velas Mainnet",
    ["106/MetaCoin.sol", "106/ConvertLib.sol"],
    "106/MetaCoin.json"
  );
  verifyContract(
    "0x084c77e84853B960aEB0a0BD4Fc6689aC9c6d76E",
    "82",
    "Meter Mainnet",
    ["82/Storage.sol"],
    "82/Storage_meta.json"
  );
  verifyContractWithImmutables(
    "0x89e772941d94Ef4BDA1e4f68E79B4bc5F6096389",
    "83",
    "Meter Testnet",
    ["uint256"],
    [666],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  verifyContract(
    "0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB",
    "1313161554",
    "Aurora Mainnet",
    ["1313161554/weth.sol"],
    "1313161554/metadata.json"
  );
  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "1313161555",
    "Aurora Testnet",
    ["uint256"],
    [123],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  //////////////////////
  // Helper functions //
  //////////////////////

  function verifyContract(
    address,
    chainId,
    chainName,
    relativeSourcePathsArray, // Allow multiple source files
    relativeMetadataPath
  ) {
    // If it is a pull request for adding new network support, only test the new network
    if (newAddedChainId && newAddedChainId != chainId) return;
    it(`should verify a contract on ${chainName} (${chainId})`, function (done) {
      const metadataPath = path.join(
        "test",
        "networks",
        "sources",
        relativeMetadataPath
      );
      const sourcePathsArray = relativeSourcePathsArray.map((relSourcePath) =>
        path.join("test", "networks", "sources", relSourcePath)
      );
      const files = {
        "metadata.json": fs.readFileSync(metadataPath).toString(),
      };
      sourcePathsArray.forEach((sourcePath, i) => {
        files[`Source_${i}.sol`] = fs.readFileSync(sourcePath).toString();
      });

      chai
        .request(server.app)
        .post("/")
        .send({
          address: address,
          chain: chainId,
          files: files,
        })
        .end((err, res) => {
          assertions(err, res, done, address);
        });
    });
  }

  function verifyContractWithImmutables(
    address,
    chainId,
    chainName,
    constructorArgTypes,
    constructorArgValues,
    relativeSourcePathsArray,
    relativeMetadataPath
  ) {
    // If it is a pull request for adding new network support, only test the new network
    if (newAddedChainId && newAddedChainId != chainId) return;
    it(`should verify a contract with immutables on ${chainName} (${chainId})`, function (done) {
      const metadataPath = path.join(
        "test",
        "networks",
        "sources",
        relativeMetadataPath
      );
      const sourcePathsArray = relativeSourcePathsArray.map((relSourcePath) =>
        path.join("test", "networks", "sources", relSourcePath)
      );
      const files = {
        "metadata.json": fs.readFileSync(metadataPath).toString(),
      };
      sourcePathsArray.forEach((sourcePath, i) => {
        files[`Source_${i}.sol`] = fs.readFileSync(sourcePath).toString();
      });
      chai
        .request(server.app)
        .post("/")
        .send({
          address: address,
          chain: chainId,
          files: files,
        })
        .end((err, res) => {
          assertions(err, res, null, address);

          chai
            .request(server.app)
            .get(
              `/repository/contracts/full_match/${chainId}/${address}/constructor-args.txt`
            )
            .buffer()
            .parse(binaryParser)
            .end((err, res) => {
              chai.expect(err).to.be.null;
              chai.expect(res.status).to.equal(StatusCodes.OK);
              const abiCoder = new ethers.utils.AbiCoder();
              const encodedParameter = abiCoder.encode(
                constructorArgTypes,
                constructorArgValues
              );
              chai.expect(res.body.toString()).to.equal(encodedParameter);
              done();
            });
        });
    });
  }

  function assertions(
    err,
    res,
    done,
    expectedAddress = contractAddress,
    expectedStatus = "perfect"
  ) {
    chai.expect(err).to.be.null;
    chai.expect(res.status).to.equal(StatusCodes.OK);
    chai.expect(res.body).to.haveOwnProperty("result");
    const resultArr = res.body.result;
    chai.expect(resultArr).to.have.a.lengthOf(1);
    const result = resultArr[0];
    chai.expect(result.address).to.equal(expectedAddress);
    chai.expect(result.status).to.equal(expectedStatus);
    if (done) done();
  }

  function binaryParser(res, cb) {
    res.setEncoding("binary");
    res.data = "";
    res.on("data", (chunk) => (res.data += chunk));
    res.on("end", () => cb(null, Buffer.from(res.data, "binary")));
  }
});
