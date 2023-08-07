const { expect } = require("chai");
const {
  RepositoryService,
} = require("../../dist/server/services/RepositoryService");

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
        "project:/contracts/a%60~!@#$%25%5E&*()-=_+%5B%5D%7B%7D%7C%5C;:'%22,%3C%3E?%C3%BF%C3%B8%C2%B1%C3%B6%C2%AB%C2%BB%C2%BF%C3%B0%EF%BF%BD~K%EF%BF%BD~X%EF%BF%BD%EF%BF%BD~_~X~@.sol"
      );
      expect(result.originalPath).to.equal(
        "project:/contracts/a`~!@#$%^&*()-=_+[]{}|\\;:'\",<>?ÿø±ö«»¿ð�~K�~X��~_~X~@.sol"
      );
    });

    it("should handle paths with certain regex patterns", () => {
      const result = instance.sanitizePath(
        "$.{37}|2{40}|cantbematchedcharacters__"
      );
      expect(result.sanitizedPath).to.equal(
        "$.%7B37%7D%7C2%7B40%7D%7Ccantbematchedcharacters__"
      );
      expect(result.originalPath).to.equal(
        "$.{37}|2{40}|cantbematchedcharacters__"
      );
    });

    it("should handle paths with spaces and backslashes", () => {
      const result = instance.sanitizePath("browser/stakingTest \\ .sol");
      expect(result.sanitizedPath).to.equal("browser/stakingTest%20%5C%20.sol");
      expect(result.originalPath).to.equal("browser/stakingTest \\ .sol");
    });
  });

  // ... more tests for other methods of RepositoryService
});
