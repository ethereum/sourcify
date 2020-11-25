const chai = require('chai');
const chaiExec = require("@jsdevtools/chai-exec");
const fs = require('fs');
const path = require('path');

chai.use(chaiExec);
const EXPECTED_OUTPUT_DIR = path.join("test", "expected-output");
const SCRIPT_PATH = path.join("build", "index.js");

String.prototype.format = function() {
    a = this;
    for (k in arguments) {
      a = a.replace("{" + k + "}", arguments[k])
    }
    return a;
}

function compareExecutionWithFile(commandArguments, expectedFileName, expectedExitCode) {
    const command = `node ${SCRIPT_PATH} ${commandArguments}`;
    const myCLI = chaiExec(command);
    const expectedFilePath = path.join(EXPECTED_OUTPUT_DIR, expectedFileName);
    const expectedOutput = fs.readFileSync(expectedFilePath).toString().format(process.cwd());
    chai.expect(myCLI).stdout.to.equal(expectedOutput);
    chai.expect(myCLI).exitCode.to.equal(expectedExitCode);
}

describe("main", function() {    
    it("should succeed for single source file", function() {
        const testPath = path.join("test", "files", "single");
        compareExecutionWithFile(testPath, "single-correct.txt", 0);
    });

    it("should fail for single source file missing", function() {
        const testPath = path.join("test", "files", "single", "metadata.json");
        compareExecutionWithFile(testPath, "single-missing-source.txt", 1);
    });

    it("should fail for nonexistent path", function() {
        const testPaths = [
            path.join("test", "files", "single", "foobar.sol"),
            path.join("test", "files", "single", "metadata.json")
        ];
        compareExecutionWithFile(testPaths.join(" "), "nonexistent-path.txt", 1);
    });

    it("should fail for metadata missing", function() {
        const testPath = path.join("test", "files", "single", "1_Storage.sol");
        compareExecutionWithFile(testPath, "single-missing-metadata.txt", 1);
    });

    it("should succeed for multiple files", function() {
        const testPath = path.join("test", "files", "multiple");
        compareExecutionWithFile(testPath, "multiple-correct.txt", 0);
    });

    it("should fail for multiple files required, some missing", function() {
        const testPaths = [
            path.join("test", "files", "multiple", "Main.sol"),
            path.join("test", "files", "multiple", "Escrow.sol"),
            path.join("test", "files", "multiple", "metadata.json")
        ];
        compareExecutionWithFile(testPaths.join(" "), "multiple-missing-source.txt", 1);
    });

    it("should succeed for zipped truffle project", function() {
        const testPath = path.join("test", "files", "truffle-example.zip");
        compareExecutionWithFile(testPath, "truffle-example-correct.txt", 0);
    });

    it("should fail for zipped truffle project with missing sources", function() {
        const testPath = path.join("test", "files", "truffle-example-missing-source.zip");
        compareExecutionWithFile(testPath, "truffle-example-missing-source.txt", 1);
    });

    it("should fail for the only source file having wrong hash", function() {
        const testPath = path.join("test", "files", "single-altered");
        compareExecutionWithFile(testPath, "single-altered.txt", 1);
    });

    it("should fail for multiple source files, one having wrong hash", function() {
        const testPath = path.join("test", "files", "multiple-altered");
        compareExecutionWithFile(testPath, "multiple-altered.txt", 1);
    });

    it("should succeed for a metadata file with content", function() {
        const testPath = path.join("test", "files", "metadata-with-content.json");
        compareExecutionWithFile(testPath, "metadata-with-content.txt", 0);
    });

    it("should fail for a metadata file with altered content", function() {
        const testPath = path.join("test", "files", "metadata-with-content-altered.json");
        compareExecutionWithFile(testPath, "metadata-with-content-altered.txt", 1);
    });

    it("should render standard-json for single source case (short option name)", function() {
        const testPath = path.join("test", "files", "single");
        const options = "-j browser/1_Storage.sol:Storage";
        const commandArguments = `${options} ${testPath}`;
        compareExecutionWithFile(commandArguments, "single.json", 0);
    });

    it("should render standard-json for single source case (full option name)", function() {
        const testPath = path.join("test", "files", "single");
        const options = "--prepare-json browser/1_Storage.sol:Storage";
        const commandArguments = `${options} ${testPath}`;
        compareExecutionWithFile(commandArguments, "single.json", 0);
    });

    it("should render standard-json for single source case when contract path is omitted", function() {
        const testPath = path.join("test", "files", "single");
        const options = "-j Storage";
        const commandArguments = `${options} ${testPath}`;
        compareExecutionWithFile(commandArguments, "single.json", 0);
    });

    it("should render standard-json for single source case when contract name is omitted", function() {
        const testPath = path.join("test", "files", "single");
        const options = "-j browser/1_Storage.sol";
        const commandArguments = `${options} ${testPath}`;
        compareExecutionWithFile(commandArguments, "single.json", 0);
    });

    it("should not render standard-json for errors existing in a single source case", function() {
        const testPath = path.join("test", "files", "single-altered");
        const options = "-j browser/1_Storage.sol:Storage";
        const commandArguments = `${options} ${testPath}`;
        compareExecutionWithFile(commandArguments, "single-no-json.txt", 1);
    });

    it("should not render standard-json for missing target", function() {
        const testPath = path.join("test", "files", "single");
        const options = "-j browser/Savings.sol:Savings";
        const commandArguments = `${options} ${testPath}`;
        compareExecutionWithFile(commandArguments, "target-not-found.txt", 1)
    })

    it("should fail for multiple compilationTargets", function() {
        const testPath = path.join("test", "files", "metadata-multiple-targets.json");
        compareExecutionWithFile(testPath, "multiple-targets.txt", 1);
    });
});