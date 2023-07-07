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
const addContext = require("mochawesome/addContext");
const { assertVerification } = require("../helpers/assertions");

const TEST_TIME = 30000; // 30 seconds

// Extract the chainId from new chain support pull request, if exists
const newAddedChainId = process.env.NEW_CHAIN_ID;
console.log("newAddedChainId");
console.log(newAddedChainId);

let anyTestsPass = false; // Fail when zero tests passing

chai.use(chaiHttp);

describe("Test Supported Chains", function () {
  this.timeout(TEST_TIME);
  const server = new Server();
  let currentResponse = null; // to log server response when test fails

  const testedChains = new Set(); // Track tested chains and make sure all "supported = true" chains are tested

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
    if (!anyTestsPass && newAddedChainId) {
      throw new Error(
        "There needs to be at least one passing test. Did you forget to add a test for your new chain with the id " +
          newAddedChainId +
          "?"
      );
    }
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

  // Symplexia Smart Chain
  verifyContract(
    "0x968fd0BADc643B0A7b088f4b6aA2CE5FA65db622",
    "1149",
    "Symplexia Smart Chain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x801f3983c7baBF5E6ae192c84E1257844aDb4b4D",
    "1",
    "Ethereum Mainnet",
    ["1/airdrop.sol", "1/IERC20.sol"],
    "1/metadata.json"
  );

  // verifyContract(
  //   "0x1EFFEbE8B0bc20f2Dc504AA16dC76FF1AB2297A3",
  //   "4",
  //   "Rinkeby",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  verifyContract(
    "0xc24381dB2a5932B5D1c424f567A95F9966834cE0",
    "5",
    "Goerli",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "11155111",
    "Sepolia",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x7f185202a630F09e05b6C2b51618b4f6Af728c7B",
    "100",
    "xDai",
    ["100/test.sol"],
    "100/metadata.json"
  );

  // verifyContract(
  //   "0x2e4088DcA1aE2e098e322562ab1fEb83b3a303CD",
  //   "300",
  //   "Optimism on Gnosis",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  verifyContract(
    "0x8C3FA94eb5b07c9AF7dBFcC53ea3D2BF7FdF3617",
    "51",
    "XinFin Apothem Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "97",
    "Binance Smart Chain Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x9969150c2AA0140F5109Ae29A51FA109Fe1d1d9C",
    "137",
    "Polygon (Matic)",
    ["137/tokengenerator.sol"],
    "137/metadata.json"
  );

  verifyContract(
    "0x5D40b45C202531d040e0CCD51C48554109197cD3",
    "80001",
    "Polygon Mumbai Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x03943C3ef00d92e130185CeBC0bcc435Def2cC94",
    "42220",
    "Celo Mainnet",
    ["42220/FMTLOL.sol"],
    "42220/metadata.json"
  );

  verifyContract(
    "0xdd5FFA1DF887D5A42931a746BaAd62574501A5Aa",
    "62320",
    "Celo Baklava Testnet",
    ["62320/0xdd5FFA1DF887D5A42931a746BaAd62574501A5Aa/AVA.sol"],
    "62320/0xdd5FFA1DF887D5A42931a746BaAd62574501A5Aa/metadata.json"
  );

  verifyContract(
    "0x03943C3ef00d92e130185CeBC0bcc435Def2cC94",
    "43114",
    "Avalanche Mainnet",
    ["42220/FMTLOL.sol"],
    "42220/metadata.json"
  );

  verifyContract(
    "0x35C671Ea8e4Fd1e922157D48EABD5ab6b8CC408E",
    "43113",
    "Avalanche Fuji Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "41",
    "Telos EVM Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x059611daEdBA5Fe0875aC7c76d7cE47FfE5c39C5",
    "40",
    "Telos EVM Testnet",
    ["40/nano.sol"],
    "40/metadata.json"
  );

  // verifyContract(
  //   "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
  //   "77",
  //   "Sokol",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  verifyContract(
    "0x0e9b6C08Fe70Aac8fd08a74a076c2B1C9f7c7d14",
    "42161",
    "Arbitrum Mainnet",
    ["42161/BalanceFetcher.sol"],
    "42161/metadata.json"
  );

  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "421613",
    "Arbitrum Görli",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  // verifyContract(
  //   "0x34eC0cBd5E33e7323324333434fe978f1000d9cd",
  //   "4216137055",
  //   "OneLedger Frankenstein Testnet",
  //   ["4216137055/SigmaToken.sol"],
  //   "4216137055/SigmaToken.json"
  // );

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
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "5700",
    "Syscoin Tanenbaum Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Rollux Mainnet
  verifyContract(
    "0x1187124eC74e2A2F420540C338186dD702cF6340",
    "570",
    "Rollux Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Rollux Tanenbaum (testnet)
  verifyContract(
    "0x736bfcA6a599bF0C3D499F8a0bC5ab2bA2030AC6",
    "57000",
    "Rollux Tanenbaum",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0xE295aD71242373C37C5FdA7B57F26f9eA1088AFe",
    "10",
    "Optimism Mainnet",
    ["10/file.sol"],
    "10/metadata.json"
  );

  verifyContract(
    "0xB5FAD02EbF6edffbdf206d2C1ad815bcDdb380f8",
    "420",
    "Optimism Goerli Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  verifyContract(
    "0x43f980475B9eb5D93A19dfA84511ECE7b330c226",
    "288",
    "Boba Network",
    ["288/Storage.sol"],
    "288/metadata.json"
  );

  // verifyContract(
  //   "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
  //   "28",
  //   "Boba Network Rinkeby Testnet",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

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

  // // Candle
  // verifyContract(
  //   "0xaa80bC172F3275B837C0515d3d50AcC4EC0cC96b",
  //   "534",
  //   "Candle Mainnet",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  // Palm
  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "11297108109",
    "Palm Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Palm Testnet
  verifyContract(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "11297108099",
    "Palm Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Fuse Mainnet
  verifyContract(
    "0xCaFC1F87E4cabD59fAB26d02D09207147Aae3F1E",
    "122",
    "Fuse Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // // Darwinia Pangolin Testnet
  // verifyContract(
  //   "0x7de04a7596958D44baB52F4e5D0c9e79cB16ef8B",
  //   "43",
  //   "Darwinia Pangolin Testnet",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

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

  // Evmos Mainnet
  verifyContract(
    "0x1d897A65A4fa98BBdfc2e94ad2357cE051Bf4a21",
    "9001",
    "Evmos Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
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

  // Gather Mainnet
  verifyContract(
    "0x5b470D7B8165D109E3Fd2e2B4E7a30Cb89C051e5",
    "192837465",
    "GTH",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Gather Testnet
  verifyContract(
    "0x08Da5501c22AE1ce2621724Ca1A03383d6C12c4d",
    "356256156",
    "GTH",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // // Gather Devnet
  // verifyContract(
  //   "0xEeE72e2295E181BaB1ef049bFEAaf5fC348998C5",
  //   "486217935",
  //   "GTH",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  // DFK Chain Testnet
  verifyContract(
    "0x276946F2453538E882281d5A36ad6d19BBDfdaA7",
    "335",
    "DFK Chain Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // DFK Chain Mainnet
  verifyContract(
    "0xB98EBF39148D39536C7f312E059990Dc59Aa26B5",
    "53935",
    "DFK Chain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Energy Web Volta Testnet
  verifyContract(
    "0x4667b7ce62e56B71146885555c68d2DDdf63349A",
    "73799",
    "Energy Web Volta Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Energy Web Chain
  verifyContract(
    "0xd07BECd1b2FE97924a2d4A0cF2d96e499ce28cA9",
    "246",
    "Energy Web Chain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Godwoken testnet v1.1
  verifyContract(
    "0xc8D69B4D58bb79D03C0b83DbBAE509DAF3135e74",
    "71401",
    "Godwoken Testnet (V1.1)",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Godwoken mainnet v1.1
  verifyContract(
    "0x0aEF0854bCD792cb37FA0e75c27a1bC326d11725",
    "71402",
    "Godwoken Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Dexalot Testnet
  verifyContract(
    "0xfa5a1E7788514Ae2B879377cF08a9CF2901d3A21",
    "432201",
    "Dexalot Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Dexalot Mainnet
  verifyContract(
    "0x1c799C32a6cF228D0656f3B87D60224afaB45903",
    "432204",
    "Dexalot Subnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // //Crystaleum
  // verifyContract(
  //   "0x8Ab612E257534b7d5a6E315444f1C45c434eAaCf",
  //   "103090",
  //   "Crystaleum",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  //Kekchain (testnet)
  verifyContract(
    "0x6FCe618B0677EdFCca9d38ed48Af89a8c056C938",
    "420666",
    "Kekchain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  //Kekchain Main Net (kekistan)
  verifyContract(
    "0xbc0103404476AF674756911553b7A45B55e989e5",
    "420420",
    "Kekchain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Canto
  verifyContract(
    "0x65ec06aF7b8A6cBa7E7226e70dd2eBd117b823Cd",
    "7700",
    "Canto",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Canto Testnet
  verifyContract(
    "0x37e12c98b4663DcE9ab1460073D9Fe82A7bFD0d8",
    "7701",
    "Canto Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // // POA Network Core
  // verifyContract(
  //   "0x3b2e3383AeE77A58f252aFB3635bCBd842BaeCB3",
  //   "99",
  //   "POA Core",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  // // Astar (EVM)
  // verifyContract(
  //   "0xA7e70Be8A6563DCe75299c30D1566A83fC63BC37",
  //   "592",
  //   "Astar (EVM)",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  // Gnosis Chiado Testnet
  verifyContract(
    "0xd46fd24ea21F04459407Fb0B518451e54d0b07a1",
    "10200",
    "Gnosis Chiado Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Klaytn Testnet Baobab
  verifyContract(
    "0x662749a392CeB1b5973a90FB2c388a2C18B8812c",
    "1001",
    "Klaytn Testnet Baobab",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Klaytn Mainnet Cypress
  verifyContract(
    "0x3b2e3383AeE77A58f252aFB3635bCBd842BaeCB3",
    "8217",
    "Klaytn Mainnet Cypress",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Shiden (EVM)
  verifyContract(
    "0x3b2e3383AeE77A58f252aFB3635bCBd842BaeCB3",
    "336",
    "Shiden (EVM)",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Chain support turned off
  // // Optimism Bedrock: Goerli Alpha Testnet
  // verifyContract(
  //   "0xA7e70Be8A6563DCe75299c30D1566A83fC63BC37",
  //   "28528",
  //   "Optimism Bedrock: Goerli Alpha Testnet",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  // ZetaChain: Athens Testnet
  verifyContract(
    "0x52ef49D23630EF439a8177E1e966F1953f37473f",
    "7001",
    "ZetaChain Athens Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Oasis Emerald Mainnet
  verifyContract(
    "0x7228Ab1F57e6fFd9F85930b9a9C2E9DD2307E4D0",
    "42262",
    "Oasis Emerald Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Oasis Emerald Testnet
  verifyContract(
    "0x70D7603cAc831A9f23Fc7cAc301db300D55EA921",
    "42261",
    "Oasis Emerald Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Songbird Canary Network
  verifyContract(
    "0x024829b4A91fB78437A854380c89A3fFc966c2D1",
    "19",
    "Songbird Canary Network",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // // Flare Mainnet
  // verifyContract(
  //   "0xbBc2EdeDc9d2d97970eE20d0Dc7216216a27e635",
  //   "14",
  //   "Flare Mainnet",
  //   ["shared/1_Storage.sol"],
  //   "shared/1_Storage.metadata.json"
  // );

  // Oasis Sapphire Mainnet
  verifyContract(
    "0xFBcb580DD6D64fbF7caF57FB0439502412324179",
    "23294",
    "Oasis Sapphire",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Oasis Sapphire Testnet
  verifyContract(
    "0xFBcb580DD6D64fbF7caF57FB0439502412324179",
    "23295",
    "Oasis Sapphire Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Stratos Testnet
  verifyContract(
    "0x9082db5F71534984DEAC8E4ed66cFe364d77dd36",
    "2047",
    "Stratos Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Bear Network Chain Mainnet
  verifyContract(
    "0x0f103813fa15CA19b6C4B46a0Afe99440b81d7C3",
    "641230",
    "Bear Network Chain Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Base Goerli Testnet
  verifyContract(
    "0x8F78b9c92a68DdF719849a40702cFBfa4EB60dD0",
    "84531",
    "Base Goerli Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Wanchain Mainnet
  verifyContract(
    "0xC3649123BCa36c0c38A71bDbd2F508AB4f939f47",
    "888",
    "Wanchain Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Wanchain Testnet
  verifyContract(
    "0x500E12a948E9Fc594bC6Fe86B3B270B5a67332D8",
    "999",
    "Wanchain Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // The Root Network Mainnet
  verifyContract(
    "0x6C0cE8d62F1D81464F6F4DecB62f97aa83B8Df89",
    "7668",
    "The Root Network Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // The Root Network Porcini (Testnet)
  verifyContract(
    "0x225F2cD344c61152F8E7200E62e03dEfD683f2c4",
    "7672",
    "The Root Network Porcini",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Hedera Mainnet
  verifyContract(
    "0x00000000000000000000000000000000002265bb",
    "295",
    "Hedera Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // DogeChain Mainnet
  verifyContract(
    "0x2a35F4AA0d3e417e8896E972f35dba4b39b6305e",
    "2000",
    "DogeChain Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Bitkub Chain Testnet
  verifyContract(
    "0x58909Ef2F2b167F52cF46575f1582500287cCE48",
    "25925",
    "Bitkub Chain Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Bitkub Chain
  verifyContract(
    "0xC75f4D89A0DdA70Ad613908D9976E90dAb42035c",
    "96",
    "Bitkub Chain",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Cronos Mainnet Beta
  verifyContract(
    "0xEdE2053329D203E8261B47A10540Ee4b7a596667",
    "25",
    "Cronos Mainnet Beta",
    ["25/storage.sol"],
    "25/metadata.json"
  );

  // Elysium Mainnet Chain
  verifyContract(
    "0x20563837F7423465699D7675BCB82f886a761c25",
    "1339",
    "Elysium Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Taiko Alpha-3 Testnet
  verifyContract(
    "0x68107Fb54f5f29D8e0B3Ac44a99f4444D1F22a68",
    "167005",
    "Taiko Alpha-3 Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // ZORA Mainnet
  verifyContract(
    "0x090734f94FA67590702421A9B61892509b7CE80A",
    "7777777",
    "ZORA MAinnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // UPTN Chain Mainnet
  verifyContract(
    "0x212F6222fB4937978A806b14FB2725169825078F",
    "6119",
    "UPTN Chain",
    [
      "6119/ERC4906.sol",
      "6119/UptnNFTsV1.sol",
      "6119/IUPTNAddressValidator.sol",
    ],
    "6119/UptnNFTsV1.metadata.json"
  );

  // KAVA EVM
  verifyContract(
    "0xAdFa11e737ec8fA6e91091468aEF33a66Ae0044c",
    "2222",
    "Kava EVM",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Siberium Testnet
  verifyContract(
    "0x60E9b3CD8C160Ce6408dD6E2Fa938895cfF7E087",
    "111000",
    "Siberium Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Ethereum Classic Mainnet
  verifyContract(
    "0x45a82B987a4e5d7D00eD5aB325DF00850cDAbBAC",
    "61",
    "Ethereum Classic Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Filecoin Mainnet
  verifyContract(
    "0x23396626F2C9c0b31cC6C2729172103961Ae2A26",
    "314",
    "Filecoin Mainnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Zilliqa EVM
  verifyContract(
    "0x6F85669808e20b121980DE8E7a794a0cc90fDc77",
    "32769",
    "Zilliqa EVM",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );
  // Zilliqa EVM Testnet
  verifyContract(
    "0xeb6Ea260eDFb9837ed100B09c559081AfA5b0785",
    "33101",
    "Zilliqa EVM Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // KAVA EVM Testnet
  verifyContract(
    "0x40b4f95C3bafc8d690B4c3fDD1E8303c4817Cd9C",
    "2221",
    "Kava EVM Testnet",
    ["shared/1_Storage.sol"],
    "shared/1_Storage.metadata.json"
  );

  // Finally check if all the "supported: true" chains have been tested
  it("should have tested all supported chains", function (done) {
    if (newAddedChainId) {
      // Don't test all chains if it is a pull request for adding new chain support
      return this.skip();
    }
    chai
      .request(server.app)
      .get("/chains")
      .end((err, res) => {
        chai.assert.equal(err, null);
        chai.assert.equal(res.status, 200);
        const supportedChains = res.body.filter((chain) => chain.supported);
        const untestedChains = [];
        supportedChains.forEach((chain) => {
          if (chain.chainId == 1337 || chain.chainId == 31337) return; // Skip LOCAL_CHAINS: Ganache and Hardhat
          if (!testedChains.has(chain.chainId.toString())) {
            untestedChains.push(chain);
          }
        });
        chai.assert(
          untestedChains.length == 0,
          `There are untested chains!: ${untestedChains
            .map((chain) => `${chain.name} (${chain.chainId})`)
            .join(",\n")}`
        );

        done();
      });
  });

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
          assertVerification(err, res, done, address, chainId);
          anyTestsPass = true;
        });
    });
    testedChains.add(chainId);
  }
});
