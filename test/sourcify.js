// process.env.MOCK_REPOSITORY='./mockRepository';

// const chai = require('chai');
// const chaiExec = require("@jsdevtools/chai-exec");
// const dotenv = require('dotenv');
// const path = require('path');

// dotenv.config({ path: path.resolve(__dirname, "..", "environments/.env") });
// chai.use(chaiExec);

// describe("CLI test", function () {

//     this.timeout(250000);

//     it("should ask for arguments", function () {
//         const myCLI = chaiExec('node dist/sourcify.js');
//         chai.expect(myCLI).stderr.to.contain("Missing required arguments: chain, address");
//         chai.expect(myCLI).exitCode.to.equal(1);
//     })
//     it("should ask for address", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "-c"]);
//         chai.expect(myCLI).stderr.to.contain("Missing required argument: address");
//         chai.expect(myCLI).exitCode.to.equal(1);
//     })
//     it("should ask for chain", function () {
//         const myCLI = chaiExec(["node", "dist/sourcify.js",
//             "-a"]);
//         chai.expect(myCLI).stderr.to.contain("Missing required argument: chain");
//         chai.expect(myCLI).exitCode.to.equal(1);
//     })
//     it("should show help", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "--help"]);
//         chai.expect(myCLI).to.have.stdout.that.matches(/^Options:\n\s*--help\s*Show help\s*\[boolean\]\n\s*--version\s*Show version number\s*\[boolean\]/);
//         chai.expect(myCLI).exitCode.to.equal(0);
//     })
//     it("should show version number", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "--version"]);
//         chai.expect(myCLI).to.have.stdout.that.matches(/^\d{1,}.\d{1,}.\d{1,}/);
//         chai.expect(myCLI).exitCode.to.equal(0);
//     })
//     it("should pass verification (upload files)", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "-c", "1",
//             "-a", "0xfff0f5801a9e13426c306455A3BcC5EF3e9BC979",
//             "-r", process.env.MOCK_REPOSITORY,
//             "-f", "test/testcontracts/ERC20Standard/ERC20Standard.sol", "test/testcontracts/ERC20Standard/metadata.json",
//             "--id", process.env.INFURA_ID]);
//         chai.expect(myCLI).to.have.stdout.that.contains("perfect");
//         chai.expect(myCLI).exitCode.to.equal(0);
//     })
//     it("should pass verification (existing sourcecode)", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "-c", "1",
//             "-a", "0xfff0f5801a9e13426c306455A3BcC5EF3e9BC979",
//             "-r", process.env.MOCK_REPOSITORY,
//             "--id", process.env.INFURA_ID]);
//         chai.expect(myCLI).to.have.stdout.that.contains("perfect");
//         chai.expect(myCLI).exitCode.to.equal(0);
//     })
//     it("should return status partial", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "-c", "5",
//             "-a", "0xf9F5B09d781aE52aE6829C398a9548005bDF82b6",
//             "-r", process.env.MOCK_REPOSITORY,
//             "-f", "test/testcontracts/1_Storage/1_Storage.sol", "test/testcontracts/1_Storage/metadata.json",
//             "--id", process.env.INFURA_ID]);
//         chai.expect(myCLI).to.have.stdout.that.contains("partial");
//         chai.expect(myCLI).exitCode.to.equal(0);
//     })
//     it("should say that address is not found", function () {
//         const myCLI = chaiExec(["node",
//             "dist/sourcify.js",
//             "-c", "1",
//             "-a", "0xfff0f5801a9e13426c306455A3BcC5EF3e9BC978",
//             "--id", process.env.INFURA_ID]);
//         chai.expect(myCLI).to.have.stdout.that.contains("Address for specified chain not found in repository");
//         chai.expect(myCLI).exitCode.to.equal(0);
//     })
// })
