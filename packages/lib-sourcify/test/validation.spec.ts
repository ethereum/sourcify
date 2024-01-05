import {
  extractHardhatMetadataAndSources,
  pathContentArrayToStringMap,
  unzipFiles,
} from '../src';
import path from 'path';
import fs from 'fs';
import { expect } from 'chai';
import hardhatOutput from './validation/files/hardhat-output/output.json';

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
