const chai = require('chai');
const Path = require('path');
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
            
            chai.expect(CheckedContract.isValid(onlyContract));
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

            chai.expect(!CheckedContract.isValid(onlyContract));
            chai.expect(onlyContract.solidity).to.be.empty;
            chai.expect(objectLength(onlyContract.missing)).to.equal(1);
            chai.expect(onlyContract.missing).to.have.key("browser/1_Storage.sol");
            chai.expect(onlyContract.invalid).to.be.empty;
        });

        it("should throw for no metadata found", function() {
            const paths = [Path.join("test", "files", "single", "1_Storage.sol")];
            chai.expect(
                () => validationService.checkPaths(paths)
            ).to.throw();
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
    });
});