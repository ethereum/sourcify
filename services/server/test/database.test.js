const { expect } = require("chai");
const { StorageService } = require("../dist/server/services/StorageService");
const {
  createCheckedContract,
} = require("../dist/server/controllers/verification/verification.common");
const config = require("config");
const _checkedContract = require("./testcontracts/Database/CheckedContract.json");
const match = require("./testcontracts/Database/Match.json");
const {
  PostgresPoolMock,
  getStoreMatchQueriesResults,
} = require("./mocks/PostgresPoolMock");

describe("Database", function () {
  this.timeout(20000);
  const storageService = new StorageService({
    repositoryV1ServiceOptions: {
      ipfsApi: process.env.IPFS_API,
      repositoryPath: "./dist/data/mock-repositoryV1",
      repositoryServerUrl: config.get("repositoryV1.serverUrl"),
    },
    sourcifyDatabaseServiceOptions: {
      postgres: {
        host: "",
        port: "",
        database: "",
        user: "",
        password: "",
      },
    },
  });

  storageService.sourcifyDatabase.databasePool = new PostgresPoolMock();

  it.only("storeMatch", (done) => {
    // Prepare the CheckedContract
    const checkedContract = createCheckedContract(
      _checkedContract.metadata,
      _checkedContract.solidity,
      _checkedContract.missing,
      _checkedContract.invalid
    );
    checkedContract.creationBytecode = _checkedContract.creationBytecode;
    checkedContract.runtimeBytecode = _checkedContract.runtimeBytecode;
    checkedContract.compilerOutput = _checkedContract.compilerOutput;
    checkedContract.creationBytecodeCborAuxdata =
      _checkedContract.creationBytecodeCborAuxdata;
    checkedContract.runtimeBytecodeCborAuxdata =
      _checkedContract.runtimeBytecodeCborAuxdata;

    // Set the postgress mock to return the expected query results
    storageService.sourcifyDatabase.databasePool.setQueryResults(
      getStoreMatchQueriesResults()
    );
    storageService.sourcifyDatabase.databasePool.on(
      "query",
      ({ queryIndex, args }) => {
        if (queryIndex === 0) {
          expect(args[1][0]).to.equal(
            "0x3fb172770fe5f17cc5fc91240d402d03e2d41e7f1f4cde20be1632f91b5aba10"
          );
        }
        if (queryIndex === 1) {
          expect(args[1][0]).to.equal(
            "0x3cf5f8b715386ca84f6e534036402bdcc971f76af209483a6c927d61cd6ae487"
          );
        }
        if (queryIndex === 2) {
          expect(args[1][0]).to.equal(
            "0xeefc26a7af085044091a53e97e025877f82d04d6be10bb05ab4e58fd8b2aa964"
          );
        }
        if (queryIndex === 3) {
          expect(args[1][0]).to.equal(
            "0x57215af35ccfd1736f06d0fc730d3affc047544a35f9656f3559223ea6e79b1e"
          );
        }
        if (queryIndex === 4) {
          expect(args[1][0]).to.equal(
            "0x3fb172770fe5f17cc5fc91240d402d03e2d41e7f1f4cde20be1632f91b5aba10"
          );
        }
        if (queryIndex === 5) {
          expect(args[1][0]).to.equal(
            "0x57215af35ccfd1736f06d0fc730d3affc047544a35f9656f3559223ea6e79b1e"
          );
          done();
        }
      }
    );

    // Call storeMatch
    storageService.storeMatch(checkedContract, match);
  });
});
