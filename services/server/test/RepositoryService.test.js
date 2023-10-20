const { expect } = require("chai");
const {
  RepositoryService,
} = require("../dist/server/services/RepositoryService");

describe("RepositoryService", () => {
  const instance = new RepositoryService("./dist/data/mock-repository");

  describe("sanitizePath function", () => {
    it("should remove directory traversal sequences", () => {
      const result = instance.sanitizePath("some/path/../to/file.txt");
      expect(result.sanitizedPath).to.equal("some/to/file.txt");
      expect(result.originalPath).to.equal("some/path/../to/file.txt");
    });

    it("should return the original path unchanged", () => {
      const result = instance.sanitizePath("some/path/to/file.txt");
      expect(result.sanitizedPath).to.equal("some/path/to/file.txt");
      expect(result.originalPath).to.equal("some/path/to/file.txt");
    });

    it("should convert absolute paths to relative", () => {
      const result = instance.sanitizePath("/absolute/path/to/file.txt");
      expect(result.sanitizedPath).to.equal("absolute/path/to/file.txt");
      expect(result.originalPath).to.equal("/absolute/path/to/file.txt");
    });

    it("should not keep any .. even if there are no upper directories left", () => {
      const result = instance.sanitizePath("path/../../../../to/file.txt");
      expect(result.sanitizedPath).to.equal("to/file.txt");
      expect(result.originalPath).to.equal("path/../../../../to/file.txt");
    });

    it("should sanitize a path containing localhost and directory traversal sequences", () => {
      const result = instance.sanitizePath(
        "localhost/../Users/pc/workspace/remixsrc/openzeppelin-contracts/IOSB/token/ERC20/ERC20Pausable.sol"
      );
      expect(result.sanitizedPath).to.equal(
        "Users/pc/workspace/remixsrc/openzeppelin-contracts/IOSB/token/ERC20/ERC20Pausable.sol"
      );
      expect(result.originalPath).to.equal(
        "localhost/../Users/pc/workspace/remixsrc/openzeppelin-contracts/IOSB/token/ERC20/ERC20Pausable.sol"
      );
    });

    it("should not modify a file name containing '..'", () => {
      const result = instance.sanitizePath("myToken..sol");
      expect(result.sanitizedPath).to.equal("myToken..sol");
      expect(result.originalPath).to.equal("myToken..sol");
    });

    it("should sanitize a URL path containing directory traversal sequences", () => {
      const result = instance.sanitizePath(
        "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/../../utils/Context.sol"
      );
      expect(result.sanitizedPath).to.equal(
        "https:/github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Context.sol"
      );
      expect(result.originalPath).to.equal(
        "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/../../utils/Context.sol"
      );
    });
    it("should not change special characters in the path", () => {
      const result = instance.sanitizePath(
        "project:/contracts/a`~!@#$%^&*()-=_+[]{}|\\;:'\",<>?ÿø±ö«»¿ð�~K�~X��~_~X~@.sol"
      );
      expect(result.sanitizedPath).to.equal(
        "project:/contracts/a`~!@#$%^&*()-=_+[]{}|\\;:'\",<>?ÿø±ö«»¿ð�~K�~X��~_~X~@.sol"
      );
      expect(result.originalPath).to.equal(
        "project:/contracts/a`~!@#$%^&*()-=_+[]{}|\\;:'\",<>?ÿø±ö«»¿ð�~K�~X��~_~X~@.sol"
      );
    });
  });

  // ... more tests for other methods of RepositoryService
});
