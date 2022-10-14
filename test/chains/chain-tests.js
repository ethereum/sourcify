// set env vars before Server init
process.env.MOCK_REPOSITORY = "./mockRepository";
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
const addContext = require("mochawesome/addContext");

const TEST_TIME = 30000; // 30 seconds

// Extract the chainId from new chain support pull request, if exists
const newAddedChainId = process.env.NEW_CHAIN_ID;
console.log("newAddedChainId");
console.log(newAddedChainId);

chai.use(chaiHttp);

describe("Test Supported Chains", function () {
  this.timeout(TEST_TIME);
  const server = new Server();
  let currentResponse = null; // to log server response when test fails

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

  // log server response when test fails
  afterEach(function () {
    const errorBody = currentResponse && currentResponse.body;
    if (this.currentTest.state === "failed" && errorBody) {
      console.log(
        "Server response of failed test " + this.currentTest.title + ":"
      );
      console.log(errorBody);
    }
    currentResponse = null;
  });

  verifyContract(
    "0x801f3983c7baBF5E6ae192c84E1257844aDb4b4D",
    "1",
    "Ethereum Mainnet",
    ["1/airdrop.sol", "1/IERC20.sol"],
    "1/metadata.json"
  );

  verifyContractWithImmutables(
    "0xd5B284609c4C82D2E23E924522797821b89D5AC6",
    "1",
    "Ethereum Mainnet",
    ["address"],
    ["0xc1A5b551eDB9617613fEC59aD7aEA5f6a268d702"],
    ["1/immutable/BundleExecutor.sol"],
    "1/immutable/metadata.json"
  );

  verifyContract(
    "0x1EFFEbE8B0bc20f2Dc504AA16dC76FF1AB2297A3",
    "4",
    "Rinkeby",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0xc24381dB2a5932B5D1c424f567A95F9966834cE0",
    "5",
    "Goerli",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "11155111",
    "Sepolia",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContractWithImmutables(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "11155111",
    "Sepolia",
    ["uint256"],
    [11155111],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContract(
    "0x7f185202a630F09e05b6C2b51618b4f6Af728c7B",
    "100",
    "xDai",
    ["100/test.sol"],
    "100/metadata.json"
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
    "0x2e4088DcA1aE2e098e322562ab1fEb83b3a303CD",
    "300",
    "Optimism on Gnosis",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContractWithImmutables(
    "0x70BA4E669259C8f96eCc1aC5D37A91e2413a0173",
    "300",
    "Optimism on Gnosis",
    ["uint256"],
    [123],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContract(
    "0x8C3FA94eb5b07c9AF7dBFcC53ea3D2BF7FdF3617",
    "51",
    "XinFin Apothem Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContractWithImmutables(
    "0xCbdD8DD32732ce953efcD56D046294260a01C2D1",
    "51",
    "XinFin Apothem Testnet",
    ["uint256"],
    [1],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  verifyContract(
    "0xED5405Ba038587c06979374f8a595F41F5841216",
    "56",
    "Binance Smart Chain Mainnet",
    ["56/Index.sol"],
    "56/metadata.json"
  );
  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "44787",
    "Celo Alfajores Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "97",
    "Binance Smart Chain Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "97",
    "Binance Smart Chain Testnet",
    ["uint256"],
    [111],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContract(
    "0x9969150c2AA0140F5109Ae29A51FA109Fe1d1d9C",
    "137",
    "Polygon (Matic)",
    ["137/tokengenerator.sol"],
    "137/metadata.json"
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
    ["137/immutable/StakingWarmup.sol"],
    "137/immutable/metadata.json"
  );

  verifyContract(
    "0x5D40b45C202531d040e0CCD51C48554109197cD3",
    "80001",
    "Polygon Mumbai Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0x03943C3ef00d92e130185CeBC0bcc435Def2cC94",
    "42220",
    "Celo Mainnet",
    ["42220/FMTLOL.sol"],
    "42220/metadata.json"
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
    ["42220/immutable/StakingHelper.sol"],
    "42220/immutable/metadata.json"
  );

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

  verifyContract(
    "0x03943C3ef00d92e130185CeBC0bcc435Def2cC94",
    "43114",
    "Avalanche Mainnet",
    ["42220/FMTLOL.sol"],
    "42220/metadata.json"
  );

  verifyContractWithImmutables(
    "0x71dAE4788fD0Ef1f50a53380bD514FBf2fB647f6",
    "43114",
    "Avalanche Mainnet",
    ["address", "address"],
    [
      "0x63b527F4f9cAB808b0178282bC1036d4bBe54a45",
      "0xd6C5BFa9FeEA5579498EA4b04Fff86A9eB3A1a9d",
    ],
    ["43114/immutable/StakingHelper.sol"],
    "43114/immutable/metadata.json"
  );

  verifyContract(
    "0x35C671Ea8e4Fd1e922157D48EABD5ab6b8CC408E",
    "43113",
    "Avalanche Fuji Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "41",
    "Telos EVM Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0x059611daEdBA5Fe0875aC7c76d7cE47FfE5c39C5",
    "40",
    "Telos EVM Testnet",
    ["40/nano.sol"],
    "40/metadata.json"
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
      "40/immutable/Address.sol",
      "40/immutable/IERC20.sol",
      "40/immutable/SafeERC20.sol",
      "40/immutable/TokenTimelock.sol",
    ],
    "40/immutable/metadata.json"
  );

  verifyContract(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "77",
    "Sokol",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "421611",
    "Arbitrum Rinkeby",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0x0e9b6C08Fe70Aac8fd08a74a076c2B1C9f7c7d14",
    "42161",
    "Arbitrum Mainnet",
    ["42161/BalanceFetcher.sol"],
    "42161/metadata.json"
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
    ["42161/immutable/crowdsale.sol"],
    "42161/immutable/metadata.json"
  );

  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "421613",
    "Arbitrum Görli",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "421613",
    "Arbitrum Görli",
    ["uint256"],
    [256],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContract(
    "0xA25b72DADEB96E166D1a225C61b54CA29C45EBD1",
    "8",
    "Ubiq",
    ["8/GameItem.sol"],
    "8/GameItem.json"
  );

  // Oneledger
  verifyContract(
    "0x774081ECDDb30F96EB5Bb21DcAB17C73F29f5eF3",
    "311752642",
    "OneLedger Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x91c9b838B181A34623B213a4a08acE00edEDe430",
    "311752642",
    "OneLedger Mainnet",
    ["uint256"],
    [1],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
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

  verifyContract(
    "0xE295aD71242373C37C5FdA7B57F26f9eA1088AFe",
    "10",
    "Optimism Mainnet",
    ["10/file.sol"],
    "10/metadata.json"
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
      "10/immutable/iOVM_CrossDomainMessenger.sol",
      "10/immutable/ITreasury.sol",
      "10/immutable/OptimisticTreasury.sol",
      "10/immutable/Proprietor.sol",
    ],
    "10/immutable/metadata.json"
  );

  verifyContract(
    "0xB5FAD02EbF6edffbdf206d2C1ad815bcDdb380f8",
    "420",
    "Optimism Goerli Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x0a835C6dd361790d2A2F173eBf1BCd7fAa804952",
    "420",
    "Optimism Goerli Testnet",
    ["uint256"],
    [123456],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  verifyContract(
    "0x43f980475B9eb5D93A19dfA84511ECE7b330c226",
    "288",
    "Boba Network",
    ["288/Storage.sol"],
    "288/metadata.json"
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
    ["288/immutable/DODOV2RouteHelper.sol"],
    "288/immutable/metadata.json"
  );

  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "28",
    "Boba Network Rinkeby Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "28",
    "Boba Network Rinkeby Testnet",
    ["uint256"],
    [123],
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

  verifyContract(
    "0x736D468Bc8F868a80A0F9C4Ca24dacf8a5A3a684",
    "83",
    "Meter Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "1313161555",
    "Aurora Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0x08BB0D7fCe37dD766d13DC19A00c95878ed2E68c",
    "1284",
    "Moonbeam",
    ["1284/Incrementer.sol"],
    "1284/metadata.json"
  );
  verifyContract(
    "0x460947bD434b4FF90Af62f3F389b39aab0d6A77D",
    "1285",
    "Moonriver",
    ["1285/Incrementer.sol"],
    "1285/metadata.json"
  );
  verifyContract(
    "0x08BB0D7fCe37dD766d13DC19A00c95878ed2E68c",
    "1287",
    "Moonbase",
    ["1287/Incrementer.sol"],
    "1287/metadata.json"
  );
  // Candle
  verifyContract(
    "0xaa80bC172F3275B837C0515d3d50AcC4EC0cC96b",
    "534",
    "Candle Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xB1392368b6484Be37c33a0991C70359126F681E4",
    "534",
    "Candle Mainnet",
    ["uint256"],
    [20],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Palm
  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "11297108109",
    "Palm Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "11297108109",
    "Palm Mainnet",
    ["uint256"],
    [123456],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Palm Testnet
  verifyContract(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "11297108099",
    "Palm Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "11297108099",
    "Palm Testnet",
    ["uint256"],
    [123456],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Fuse Mainnet
  verifyContract(
    "0xCaFC1F87E4cabD59fAB26d02D09207147Aae3F1E",
    "122",
    "Fuse Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x1c1C66cd346c845959ffFD1642395b0adb12349a",
    "122",
    "Fuse Mainnet",
    ["uint256"],
    [100000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Darwinia Pangolin Testnet
  verifyContract(
    "0x7de04a7596958D44baB52F4e5D0c9e79cB16ef8B",
    "43",
    "Darwinia Pangolin Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  // Darwinia Crab Mainnet
  verifyContract(
    "0xE0E78187F01E026bdD0bd901e5Ae2e10C022366D",
    "44",
    "Darwinia Pangolin Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  // Evmos Testnet
  verifyContract(
    "0x07Eb2490cEfc74bAEb4B13c2dB9119CA0c38959B",
    "9000",
    "Evmos Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x697633A48F5832481f570CA6b11d793A5708bA9A",
    "9000",
    "Evmos Testnet",
    ["uint256"],
    [3000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Evmos Mainnet
  verifyContract(
    "0x1d897A65A4fa98BBdfc2e94ad2357cE051Bf4a21",
    "9001",
    "Evmos Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x886035409BCDc11c9824D065143FB5ce981a011a",
    "9001",
    "Evmos Mainnet",
    ["uint256"],
    [3000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // MultiVAC Mainnet
  verifyContract(
    "0x411925A3B2Ed99cD29DF76822D6419163d80858f",
    "62621",
    "MultiVAC Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  // WAGMI Testnet
  verifyContract(
    "0x5974BF3196fc03A20cEB196270307707e0158BbD",
    "11111",
    "WAGMI",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x92b7E7Ab420BE84E3A7aE4Fd1d99214138b298Ca",
    "11111",
    "WAGMI",
    ["uint256"],
    [100000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Gather Mainnet
  verifyContract(
    "0x5b470D7B8165D109E3Fd2e2B4E7a30Cb89C051e5",
    "192837465",
    "GTH",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xa125948C93bf2cAefdb350e40671b736716144C7",
    "192837465",
    "GTH",
    ["uint256"],
    [3000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Gather Testnet
  verifyContract(
    "0x08Da5501c22AE1ce2621724Ca1A03383d6C12c4d",
    "356256156",
    "GTH",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x83BF67FcD75Da06d8914725cd57116a347a63Cf4",
    "356256156",
    "GTH",
    ["uint256"],
    [3000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Gather Devnet
  verifyContract(
    "0xEeE72e2295E181BaB1ef049bFEAaf5fC348998C5",
    "486217935",
    "GTH",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xE5332e0C5E34187D6030E951Fe791e20864251d4",
    "486217935",
    "GTH",
    ["uint256"],
    [3000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // DFK Chain Testnet
  verifyContract(
    "0x276946F2453538E882281d5A36ad6d19BBDfdaA7",
    "335",
    "DFK Chain Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x40D843D06dAC98b2586fD1DFC5532145208C909F",
    "335",
    "DFK Chain Testnet",
    ["uint256"],
    [12345],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // DFK Chain Mainnet
  verifyContract(
    "0xB98EBF39148D39536C7f312E059990Dc59Aa26B5",
    "53935",
    "DFK Chain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x0185447543C4284e362F1dc4B21569Fe75cD4c2A",
    "53935",
    "DFK Chain",
    ["uint256"],
    [12345],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Energy Web Volta Testnet
  verifyContract(
    "0x4667b7ce62e56B71146885555c68d2DDdf63349A",
    "73799",
    "Energy Web Volta Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x2EF8DafA9640cfe902B1229DE63F308E24c59EF7",
    "73799",
    "Energy Web Volta Testnet",
    ["uint256"],
    [4],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Energy Web Chain
  verifyContract(
    "0xd07BECd1b2FE97924a2d4A0cF2d96e499ce28cA9",
    "246",
    "Energy Web Chain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xB601dE691956DC2D5A3030Dd64f08C66Be78700E",
    "246",
    "Energy Web Chain",
    ["uint256"],
    [5],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Godwoken testnet v1.1
  verifyContract(
    "0xc8D69B4D58bb79D03C0b83DbBAE509DAF3135e74",
    "71401",
    "Godwoken Testnet (V1.1)",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x61FB9329a6c1E8605856C2a66C29fF692bAe2DAa",
    "71401",
    "Godwoken Testnet (V1.1)",
    ["uint256"],
    [100000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Godwoken mainnet v1.1
  verifyContract(
    "0x0aEF0854bCD792cb37FA0e75c27a1bC326d11725",
    "71402",
    "Godwoken Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xC1FEfe58fA6A60fc34F70d518aF6F192143CAa03",
    "71402",
    "Godwoken Mainnet",
    ["uint256"],
    [100000],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Dexalot Testnet
  verifyContract(
    "0xfa5a1E7788514Ae2B879377cF08a9CF2901d3A21",
    "432201",
    "Dexalot Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x92924A2591345420542A26035be8bcf4552BeD2b",
    "432201",
    "Dexalot Testnet",
    ["uint256"],
    [100],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  //Crystaleum
  verifyContract(
    "0x8Ab612E257534b7d5a6E315444f1C45c434eAaCf",
    "103090",
    "Crystaleum",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xE32195beC48Dca3adc89b95a6c2f36e68F1A89A0",
    "103090",
    "Crystaleum",
    ["uint256"],
    [103090],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  //Kekchain (testnet)
  verifyContract(
    "0x6FCe618B0677EdFCca9d38ed48Af89a8c056C938",
    "420666",
    "Kekchain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x0E8CebF16c5E8f4b9515C69c38d6dAFa54101b6e",
    "420666",
    "Kekchain",
    ["uint256"],
    [420666],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );
  // Canto
  verifyContract(
    "0x65ec06aF7b8A6cBa7E7226e70dd2eBd117b823Cd",
    "7700",
    "Canto",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0xaF7Fd0F59255B96a60Eb53a7c680EC0E32bE397f",
    "7700",
    "Canto",
    ["uint256"],
    [7700],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  // POA Network Core
  verifyContract(
    "0x3b2e3383AeE77A58f252aFB3635bCBd842BaeCB3",
    "99",
    "POA Core",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContractWithImmutables(
    "0xA7e70Be8A6563DCe75299c30D1566A83fC63BC37",
    "99",
    "POA Core",
    ["uint256"],
    [2],
    ["shared/WithImmutables.sol"],
    "shared/withImmutables.metadata.json"
  );

  // Astar (EVM)
  verifyContract(
    "0xA7e70Be8A6563DCe75299c30D1566A83fC63BC37",
    "592",
    "Astar (EVM)",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  verifyContractWithImmutables(
    "0x571bb36009bB26D5313244B30397D2a2341a2A11",
    "592",
    "Astar (EVM)",
    ["uint256"],
    [1234],
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
    // If it is a pull request for adding new chain support, only test the new chain
    if (newAddedChainId && newAddedChainId != chainId) return;
    it(`should verify a contract on ${chainName} (${chainId})`, function (done) {
      // Context for the test report
      addContext(this, {
        title: "Test identifier",
        value: {
          chainId: chainId,
          testType: "normal",
        },
      });

      const metadataPath = path.join(
        "test",
        "chains",
        "sources",
        relativeMetadataPath
      );
      const sourcePathsArray = relativeSourcePathsArray.map((relSourcePath) =>
        path.join("test", "chains", "sources", relSourcePath)
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
    // If it is a pull request for adding new chain support, only test the new chain
    if (newAddedChainId && newAddedChainId != chainId) return;
    it(`should verify a contract with immutables on ${chainName} (${chainId})`, function (done) {
      // Context for the test report
      addContext(this, {
        title: "Test identifier",
        value: {
          chainId: chainId,
          testType: "immutable",
        },
      });

      const metadataPath = path.join(
        "test",
        "chains",
        "sources",
        relativeMetadataPath
      );
      const sourcePathsArray = relativeSourcePathsArray.map((relSourcePath) =>
        path.join("test", "chains", "sources", relSourcePath)
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
    expectedAddress,
    expectedStatus = "perfect"
  ) {
    currentResponse = res;
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
