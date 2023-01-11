const SourceFetcher = require("../dist/monitor/source-fetcher").default;
const { SourceAddress } = require("../dist/monitor/util");
const METADATA_HASH = "QmbGXtNqvZYEcbjK6xELyBQGEmzqXPDqyJNoQYjJPrST9S";
process.env.MONITOR_FETCH_TIMEOUT = 5 * 60 * 1000;

describe("Source Fetcher", function () {
  this.timeout(process.env.MONITOR_FETCH_TIMEOUT); // Overwrite Mocha timeout of 2sec

  let sourceFetcher;
  let sourceAddress;

  it("should fetch metadata from IPFS", (done) => {
    process.env.IPFS_GATEWAY = "https://ipfs.io/ipfs/";
    sourceFetcher = new SourceFetcher();
    sourceAddress = new SourceAddress("ipfs", METADATA_HASH);
    sourceFetcher.subscribe(sourceAddress, (fetchedFileStr) => {
      const jsonFile = JSON.parse(fetchedFileStr);
      console.log(jsonFile.settings.compilationTarget);
      done();
    });
  });

  it("should use the fallback IPFS gateway when primary fails", (done) => {
    process.env.IPFS_GATEWAY = "http://testinginvalidgatewaydomain/";
    sourceFetcher = new SourceFetcher();
    sourceAddress = new SourceAddress("ipfs", METADATA_HASH);
    sourceFetcher.subscribe(sourceAddress, (fetchedFileStr) => {
      const jsonFile = JSON.parse(fetchedFileStr);
      console.log(jsonFile.settings.compilationTarget);
      process.env.IPFS_GATEWAY = "https://ipfs.io/ipfs/"; // Set back to correct value
      done();
    });
  });
});
