const { expect } = require("chai");
const { StorageService } = require("../dist/server/services/StorageService");
const config = require("config");

describe("RepositoryV2", () => {
  const instance = new StorageService({
    repositoryV1ServiceOptions: {
      ipfsApi: process.env.IPFS_API,
      repositoryPath: "./dist/data/mock-repositoryV1",
      repositoryServerUrl: config.get("repositoryV1.serverUrl"),
    },
    repositoryV2ServiceOptions: {
      ipfsApi: process.env.IPFS_API,
      repositoryPath: "./dist/data/mock-repositoryV2",
    },
  });

  describe("sanitizePath function", () => {
    it("should remove directory traversal sequences", () => {
      const result = instance.repositoryV1.sanitizePath(
        "some/path/../to/file.txt"
      );
      expect(result.sanitizedPath).to.equal("some/to/file.txt");
      expect(result.originalPath).to.equal("some/path/../to/file.txt");
    });
  });
});
