process.env.TESTING = "true";

const chai = require('chai');
const Path = require('path');
const fs = require('fs');
const ValidationService = require('../build/ValidationService').ValidationService;
const { CheckedContract } = require('@ethereum-sourcify/core');
const validationService = new ValidationService();

function objectLength(obj) {
    return Object.keys(obj).length;
}

const EXTENDED_TIME = 15000; // 15 seconds

describe("ValidationService", function() {
    this.timeout(EXTENDED_TIME);

    describe("#checkPaths", function() {

        it("should succeed for single source file", function() {
            const ignoring = [];
            const paths = [Path.join("test", "files", "single")];
            const checkedContracts = validationService.checkPaths(paths, ignoring);
            
            chai.expect(ignoring).to.be.empty;
            expectationsOfSingle(checkedContracts);
        });

        it("should succeed for single source file, everything provided individually", function() {
            const ignoring = [];
            const paths = [
                Path.join("test", "files", "single", "1_Storage.sol"),
                Path.join("test", "files", "single", "metadata.json")
            ];
            const checkedContracts = validationService.checkPaths(paths, ignoring);
            
            chai.expect(ignoring).to.be.empty;
            expectationsOfSingle(checkedContracts);
        })

        function expectationsOfSingle(checkedContracts) {
            chai.expect(checkedContracts.length).to.equal(1);
            const onlyContract = checkedContracts[0];
            
            chai.expect(onlyContract.name).to.equal("Storage");
            chai.expect(onlyContract.compiledPath).to.equal("browser/1_Storage.sol");
            
            chai.expect(CheckedContract.isValid(onlyContract)).to.be.true;
            chai.expect(objectLength(onlyContract.solidity)).to.equal(1);
            chai.expect(onlyContract.solidity).to.have.all.keys("browser/1_Storage.sol");
            chai.expect(onlyContract.missing).to.be.empty;
            chai.expect(onlyContract.invalid).to.be.empty;
        }

        it("should report for single source file missing", function() {
            const ignoring = [];
            const paths = [Path.join("test", "files", "single", "metadata.json")];
            const checkedContracts = validationService.checkPaths(paths, ignoring);

            chai.expect(ignoring).to.be.empty;
            chai.expect(checkedContracts.length).to.equal(1);
            const onlyContract = checkedContracts[0];

            chai.expect(onlyContract.name).to.equal("Storage");
            chai.expect(onlyContract.compiledPath).to.equal("browser/1_Storage.sol");

            chai.expect(CheckedContract.isValid(onlyContract)).to.be.false;
            chai.expect(onlyContract.solidity).to.be.empty;
            chai.expect(objectLength(onlyContract.missing)).to.equal(1);
            chai.expect(onlyContract.missing).to.have.key("browser/1_Storage.sol");
            chai.expect(onlyContract.invalid).to.be.empty;
        });

        it("should throw for no metadata found", function() {
            const paths = [Path.join("test", "files", "single", "1_Storage.sol")];
            chai.expect(
                () => validationService.checkPaths(paths)
            ).to.throw("Metadata file not found. Did you include \"metadata.json\"?");
        });

        it("should ignore invalid paths", function() {
            const ignoring = [];
            const invalidPath = Path.join("test", "files", "foobar.sol");
            const paths = [
                Path.join("test", "files", "single"),
                invalidPath
            ];
            const checkedContracts = validationService.checkPaths(paths, ignoring);

            chai.expect(ignoring).to.deep.equal([invalidPath]);
            expectationsOfSingle(checkedContracts);
        });

        function checkSingleWithModifiedEnding(directoryName, expectedLineEnd, expectedFileEnd) {
            const ignoring = [];
            const path = Path.join("test", "files", directoryName);

            const filePath = Path.join(path, "1_Storage.sol");
            const content = fs.readFileSync(filePath).toString();

            const nCount = (content.match(/\n/g) || []).length;
            const rnCount = (content.match(/\r\n/g) || []).length;
            if (expectedLineEnd === "\n") {
                chai.expect(rnCount).to.equal(0);
            } else {
                chai.expect(nCount).to.equal(rnCount);
            }

            const endLength = expectedFileEnd.length;
            const fileEnd = content.slice(content.length - endLength);
            chai.expect(fileEnd).to.equal(expectedFileEnd);

            const checkedContracts = validationService.checkPaths([path], ignoring);

            chai.expect(ignoring).to.be.empty;
            chai.expect(checkedContracts).to.have.a.lengthOf(1);

            const contract = checkedContracts[0];
            chai.expect(contract.name).to.equal("Storage");
            chai.expect(CheckedContract.isValid(contract)).to.be.true;
        }

        it("should replace \\r\\n with \\n", function() {
            checkSingleWithModifiedEnding("single-replace-with-n", "\r\n", "}");
        });

        it("should replace \\n with \\r\\n", function() {
            checkSingleWithModifiedEnding("single-replace-with-rn", "\n", "}");
        });

        it("should add a trailing \\r\\n", function() {
            checkSingleWithModifiedEnding("single-add-trailing-rn", "\r\n", "}");
        });

        it("should add a trailing \\n", function() {
            checkSingleWithModifiedEnding("single-add-trailing-n", "\n", "}");
        });

        it("should remove a trailing \\r\\n", function() {
            checkSingleWithModifiedEnding("single-remove-trailing-rn", "\r\n", "\r\n");
        });

        it("should remove a trailing \\n", function() {
            checkSingleWithModifiedEnding("single-remove-trailing-n", "\n", "\n");
        });

        it("should validate a file with two trailing n", function() {
            // this fails if not checking the original file
            checkSingleWithModifiedEnding("single-keep-original", "\n", "\n\n");
        });
    });
});