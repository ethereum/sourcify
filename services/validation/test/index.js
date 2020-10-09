const chai = require('chai');
const chaiExec = require("@jsdevtools/chai-exec");
const fs = require('fs');
const path = require('path');

chai.use(chaiExec);
const EXPECTED_OUTPUT_DIR = path.join("test", "expected-output");
const SCRIPT_PATH = path.join("build", "index.js");

function compareExecutionWithFile(commandArguments, expectedFileName) {
    const command = `node ${SCRIPT_PATH} ${commandArguments}`;
    const myCLI = chaiExec(command);
    const expectedFilePath = path.join(EXPECTED_OUTPUT_DIR, expectedFileName);
    const expectedOutput = fs.readFileSync(expectedFilePath).toString();
    chai.expect(myCLI).stdout.to.equal(expectedOutput);
}

describe("main", function() {    
    it("should succeed for single source file", function() {
        const testPath = path.join("test", "files", "single");
        compareExecutionWithFile(testPath, "single-correct.txt");
    });

    it("should fail for single source file missing", function() {
        const testPath = path.join("test", "files", "single", "metadata.json");
        compareExecutionWithFile(testPath, "single-missing-source.txt");
    });

    it("should fail for nonexistent path", function() {
        const testPaths = [
            path.join("test", "files", "single", "foobar.sol"),
            path.join("test", "files", "single", "metadata.json")
        ];
        compareExecutionWithFile(testPaths.join(" "), "nonexistent-path.txt");
    });

    it("should fail for metadata missing", function() {
        const testPath = path.join("test", "files", "single", "1_Storage.sol");
        compareExecutionWithFile(testPath, "single-missing-metadata.txt");
    });

    it("should succeed for multiple files", function() {
        const testPath = path.join("test", "files", "multiple");
        compareExecutionWithFile(testPath, "multiple-correct.txt");
    });

    it("should fail for multiple files requires but some missing", function() {
        const testPaths = [
            path.join("test", "files", "multiple", "Main.sol"),
            path.join("test", "files", "multiple", "Escrow.sol"),
            path.join("test", "files", "multiple", "metadata.json")
        ];
        compareExecutionWithFile(testPaths.join(" "), "multiple-missing-source.txt");
    });

    it("should succeed for zipped truffle project", function() {
        const testPath = path.join("test", "files", "truffle-example.zip");
        compareExecutionWithFile(testPath, "truffle-example-correct.txt");
    });

    it("should fail for zipped truffle project with missing sources", function() {
        const testPath = path.join("test", "files", "truffle-example-incorrect.zip");
        compareExecutionWithFile(testPath, "truffle-example-incorrect.txt");
    });
});