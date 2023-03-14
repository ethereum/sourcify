import {
  checkPaths,
  extractHardhatMetadataAndSources,
  pathContentArrayToStringMap,
  unzipFiles,
} from '../src';
import path from 'path';
import { CheckedContract } from '../src';
import fs from 'fs';
import chai, { expect } from 'chai';
import hardhatOutput from './validation/files/hardhat-output/output.json';

function objectLength(obj: any) {
  return Object.keys(obj).length;
}

const EXTENDED_TIME = 15000; // 15 seconds

describe('ValidationService', function () {
  this.timeout(EXTENDED_TIME);

  describe('#checkPaths', function () {
    it('should succeed for single source file', async function () {
      const ignoring: string[] = [];
      const paths = [path.join(__dirname, 'validation', 'files', 'single')];
      const checkedContracts = await checkPaths(paths, ignoring);

      chai.expect(ignoring).to.be.empty;
      expectationsOfSingle(checkedContracts);
    });

    it('should succeed for single source file, everything provided individually', async function () {
      const ignoring: string[] = [];
      const paths = [
        path.join(__dirname, 'validation', 'files', 'single', '1_Storage.sol'),
        path.join(__dirname, 'validation', 'files', 'single', 'metadata.json'),
      ];
      const checkedContracts = await checkPaths(paths, ignoring);

      chai.expect(ignoring).to.be.empty;
      expectationsOfSingle(checkedContracts);
    });

    function expectationsOfSingle(checkedContracts: CheckedContract[]) {
      chai.expect(checkedContracts.length).to.equal(1);
      const onlyContract = checkedContracts[0];

      chai.expect(onlyContract.name).to.equal('Storage');
      chai.expect(onlyContract.compiledPath).to.equal('browser/1_Storage.sol');

      chai.expect(CheckedContract.isValid(onlyContract)).to.be.true;
      chai.expect(objectLength(onlyContract.solidity)).to.equal(1);
      chai
        .expect(onlyContract.solidity)
        .to.have.all.keys('browser/1_Storage.sol');
      chai.expect(onlyContract.missing).to.be.empty;
      chai.expect(onlyContract.invalid).to.be.empty;
    }

    it('should report for single source file missing', async function () {
      const ignoring: string[] = [];
      const paths = [
        path.join(__dirname, 'validation', 'files', 'single', 'metadata.json'),
      ];
      const checkedContracts = await checkPaths(paths, ignoring);

      chai.expect(ignoring).to.be.empty;
      chai.expect(checkedContracts.length).to.equal(1);
      const onlyContract = checkedContracts[0];

      chai.expect(onlyContract.name).to.equal('Storage');
      chai.expect(onlyContract.compiledPath).to.equal('browser/1_Storage.sol');

      chai.expect(CheckedContract.isValid(onlyContract)).to.be.false;
      chai.expect(onlyContract.solidity).to.be.empty;
      chai.expect(objectLength(onlyContract.missing)).to.equal(1);
      chai.expect(onlyContract.missing).to.have.key('browser/1_Storage.sol');
      chai.expect(onlyContract.invalid).to.be.empty;
    });

    it('should throw for no metadata found', async function () {
      let error: Error | undefined = undefined;
      const paths = [
        path.join(__dirname, 'validation', 'files', 'single', '1_Storage.sol'),
      ];
      try {
        await checkPaths(paths);
      } catch (e) {
        if (e instanceof Error) error = e;
      }
      chai.expect(error).to.be.an('Error');
      chai
        .expect(error?.message)
        .to.equal('Metadata file not found. Did you include "metadata.json"?');
    });

    it('should ignore invalid paths', async function () {
      const ignoring: string[] = [];
      const invalidPath = path.join(
        __dirname,
        'validation',
        'files',
        'foobar.sol'
      );
      const paths = [
        path.join(__dirname, 'validation', 'files', 'single'),
        invalidPath,
      ];
      const checkedContracts = await checkPaths(paths, ignoring);

      chai.expect(ignoring).to.deep.equal([invalidPath]);
      expectationsOfSingle(checkedContracts);
    });

    async function checkSingleWithModifiedEnding(
      directoryName: string,
      expectedLineEnd: string,
      expectedFileEnd: string
    ) {
      const ignoring: string[] = [];
      const directory = path.join(
        __dirname,
        'validation',
        'files',
        directoryName
      );

      const filePath = path.join(directory, '1_Storage.sol');
      const content = fs.readFileSync(filePath).toString();

      const nCount = (content.match(/\n/g) || []).length;
      const rnCount = (content.match(/\r\n/g) || []).length;
      if (expectedLineEnd === '\n') {
        chai.expect(rnCount).to.equal(0);
      } else {
        chai.expect(nCount).to.equal(rnCount);
      }

      const endLength = expectedFileEnd.length;
      const fileEnd = content.slice(content.length - endLength);
      chai.expect(fileEnd).to.equal(expectedFileEnd);

      const checkedContracts = await checkPaths([directory], ignoring);

      chai.expect(ignoring).to.be.empty;
      chai.expect(checkedContracts).to.have.a.lengthOf(1);

      const contract = checkedContracts[0];
      chai.expect(contract.name).to.equal('Storage');
      chai.expect(CheckedContract.isValid(contract)).to.be.true;
    }

    it('should replace \\r\\n with \\n', function () {
      checkSingleWithModifiedEnding('single-replace-with-n', '\r\n', '}');
    });

    it('should replace \\n with \\r\\n', function () {
      checkSingleWithModifiedEnding('single-replace-with-rn', '\n', '}');
    });

    it('should add a trailing \\r\\n', function () {
      checkSingleWithModifiedEnding('single-add-trailing-rn', '\r\n', '}');
    });

    it('should add a trailing \\n', function () {
      checkSingleWithModifiedEnding('single-add-trailing-n', '\n', '}');
    });

    it('should remove a trailing \\r\\n', function () {
      checkSingleWithModifiedEnding(
        'single-remove-trailing-rn',
        '\r\n',
        '\r\n'
      );
    });

    it('should remove a trailing \\n', function () {
      checkSingleWithModifiedEnding('single-remove-trailing-n', '\n', '\n');
    });

    it('should validate a file with two trailing n', function () {
      // this fails if not checking the original file
      checkSingleWithModifiedEnding('single-keep-original', '\n', '\n\n');
    });
  });
});

describe('Unit tests', function () {
  const pathContent = {
    path: './validation/files/hardhat-output/output.json',
    content: JSON.stringify(hardhatOutput),
  };
  it('Should extractHardhatMetadataAndSources', async function () {
    const { hardhatMetadataFiles, hardhatSourceFiles } =
      extractHardhatMetadataAndSources(pathContent);
    expect(hardhatMetadataFiles).lengthOf(6);
    expect(hardhatSourceFiles).lengthOf(6);
  });
  it('Should pathContentArrayToStringMap', async function () {
    const stringMap = pathContentArrayToStringMap([pathContent]);
    const keysInStringMap = Object.keys(stringMap);
    expect(keysInStringMap).lengthOf(1);
    expect(keysInStringMap[0]).equals(
      './validation/files/hardhat-output/output.json'
    );
  });
  it('Should unzip', async function () {
    const zippedTrufflePath = path.join(
      'test',
      'validation',
      'files',
      'truffle-example.zip'
    );
    const zippedTruffleBuffer = fs.readFileSync(zippedTrufflePath);
    const files = [
      {
        path: zippedTrufflePath,
        buffer: zippedTruffleBuffer,
      },
    ];
    await unzipFiles(files);
    expect(files).lengthOf(19);
  });
});
