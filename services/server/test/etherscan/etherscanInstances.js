// Periodical tests of Import from Etherscan for each instance e.g. Arbiscan, Etherscan, Bscscan, etc.

const Server = require("../../dist/server/server").Server;
const rimraf = require("rimraf");
const testContracts = require("../helpers/etherscanInstanceContracts.json");
const { sourcifyChainsMap } = require("../../dist/sourcify-chains");
const util = require("util");
const { verifyAndAssertEtherscan } = require("../helpers/helpers");

const CUSTOM_PORT = 5679;

describe("Test each Etherscan instance", function () {
  this.timeout(30000);
  const server = new Server(CUSTOM_PORT);

  before(async () => {
    const promisified = util.promisify(server.app.listen);
    await promisified(server.port);
    console.log(`Server listening on port ${server.port}!`);
  });

  beforeEach(() => {
    rimraf.sync(server.repository);
  });

  after(() => {
    rimraf.sync(server.repository);
  });

  for (const chainId in testContracts) {
    if (process.env.TEST_CHAIN && process.env.TEST_CHAIN !== chainId) continue;
    describe(`#${chainId} ${sourcifyChainsMap[chainId].name}`, () => {
      testContracts[chainId].forEach((contract) => {
        verifyAndAssertEtherscan(
          server.app,
          chainId,
          contract.address,
          contract.expectedStatus,
          contract.type,
          contract?.creatorTxHash
        );
      });
    });
  }
});
