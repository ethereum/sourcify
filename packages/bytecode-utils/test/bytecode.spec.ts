import chai from 'chai';
import { readFileSync } from 'fs';
import path from 'path';

import { decode, splitAuxdata } from '../src/lib/bytecode';

type Error = {
  message: string;
};

const BYTECODES_FOLDER = path.join(__dirname, 'bytecodes');
const BYTECODE_IPFS = readFileSync(`${BYTECODES_FOLDER}/ipfs.hex`).toString();
const BYTECODE_BZZR1 = readFileSync(`${BYTECODES_FOLDER}/bzzr1.hex`).toString();
const BYTECODE_WRONG = readFileSync(`${BYTECODES_FOLDER}/wrong.hex`).toString();
const BYTECODE_EXPERIMENTAL = readFileSync(
  `${BYTECODES_FOLDER}/experimental.hex`,
).toString();
const BYTECODE_WITHOUT0X = readFileSync(
  `${BYTECODES_FOLDER}/without0x.hex`,
).toString();
const BYTECODE_WITHOUTAUXDATA = readFileSync(
  `${BYTECODES_FOLDER}/withoutauxdata.hex`,
).toString();

describe('bytecode utils', function () {
  it("return the whole bytecode when the bytecode that doesn't contain auxdata", () => {
    const [execution, auxadata, length] = splitAuxdata(BYTECODE_WITHOUTAUXDATA);
    chai.expect(auxadata).to.be.undefined;
    chai.expect(length).to.be.undefined;
    chai.expect(`${execution}`).to.equal(BYTECODE_WITHOUTAUXDATA);
  });

  it('split succesfully bytecode into execution bytecode and auxadata', () => {
    const [execution, auxadata, length] = splitAuxdata(BYTECODE_IPFS);
    chai
      .expect(auxadata)
      .to.equal(
        'a2646970667358221220dceca8706b29e917dacf25fceef95acac8d90d765ac926663ce4096195952b6164736f6c634300060b',
      );
    chai.expect(`${execution}${auxadata}${length}`, BYTECODE_IPFS);
  });

  it('bytecode decode cbor with `ipfs` property', () => {
    chai
      .expect(decode(BYTECODE_IPFS).ipfs)
      .to.equal('QmdD3hpMj6mEFVy9DP4QqjHaoeYbhKsYvApX1YZNfjTVWp');
  });

  it('bytecode decode cbor with `bzzr1` property', () => {
    chai
      .expect(decode(BYTECODE_BZZR1).bzzr1)
      .to.equal(
        '0x71e0c183217ae3e9a1406ae7b58c2f36e09f2b16b10e19d46ceb821f3ee6abad',
      );
  });

  it('bytecode decode cbor with `experimental` property', () => {
    chai.expect(decode(BYTECODE_EXPERIMENTAL).experimental).to.be.true;
  });

  it('bytecode decode should fail gracefully when input is undefined', () => {
    try {
      decode('');
    } catch (e) {
      chai.expect((e as Error).message).to.equal('Bytecode cannot be null');
    }
  });

  it('decode a bytecode not starting with 0x', () => {
    chai
      .expect(decode(BYTECODE_WITHOUT0X).ipfs)
      .to.equal('QmbFc3AoHDC977j2UH2WwYSwsSRrBGj8bsiiyigXhHzyuZ');
  });

  it('bytecode decode should fail gracefully when input is corrupted', () => {
    try {
      decode(BYTECODE_WRONG);
    } catch (e) {
      chai
        .expect((e as Error).message)
        .to.equal('Auxdata is not in the execution bytecode');
    }
  });
});
