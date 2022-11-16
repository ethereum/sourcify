import { readFileSync } from 'fs';

import test from 'ava';

import { decode, splitAuxdata } from './bytecode';

type Error = {
  message: string;
};

const BYTECODES_FOLDER = './src/lib/bytecodes';
const BYTECODE_IPFS = readFileSync(`${BYTECODES_FOLDER}/ipfs.hex`).toString();
const BYTECODE_BZZR1 = readFileSync(`${BYTECODES_FOLDER}/bzzr1.hex`).toString();
const BYTECODE_WRONG = readFileSync(`${BYTECODES_FOLDER}/wrong.hex`).toString();
const BYTECODE_EXPERIMENTAL = readFileSync(
  `${BYTECODES_FOLDER}/experimental.hex`
).toString();
const BYTECODE_WITHOUT0X = readFileSync(
  `${BYTECODES_FOLDER}/without0x.hex`
).toString();
const BYTECODE_WITHOUTAUXDATA = readFileSync(
  `${BYTECODES_FOLDER}/withoutauxdata.hex`
).toString();

test("return the whole bytecode when the bytecode that doesn't contain auxdata", (t) => {
  const [execution, auxadata, length] = splitAuxdata(BYTECODE_WITHOUTAUXDATA);
  t.is(auxadata, undefined);
  t.is(length, undefined);
  t.is(`${execution}`, BYTECODE_WITHOUTAUXDATA);
});

test('split succesfully bytecode into execution bytecode and auxadata', (t) => {
  const [execution, auxadata, length] = splitAuxdata(BYTECODE_IPFS);
  t.is(
    auxadata,
    'a2646970667358221220dceca8706b29e917dacf25fceef95acac8d90d765ac926663ce4096195952b6164736f6c634300060b'
  );
  t.is(`${execution}${auxadata}${length}`, BYTECODE_IPFS);
});

test('bytecode decode cbor with `ipfs` property', (t) => {
  t.is(
    decode(BYTECODE_IPFS).ipfs,
    'QmdD3hpMj6mEFVy9DP4QqjHaoeYbhKsYvApX1YZNfjTVWp'
  );
});

test('bytecode decode cbor with `bzzr1` property', (t) => {
  t.is(
    decode(BYTECODE_BZZR1).bzzr1,
    '0x71e0c183217ae3e9a1406ae7b58c2f36e09f2b16b10e19d46ceb821f3ee6abad'
  );
});

test('bytecode decode cbor with `experimental` property', (t) => {
  t.is(decode(BYTECODE_EXPERIMENTAL).experimental, true);
});

test('bytecode decode should fail gracefully when input is undefined', (t) => {
  try {
    decode('');
  } catch (e) {
    t.is((e as Error).message, 'Bytecode cannot be null');
  }
});

test('decode a bytecode not starting with 0x', (t) => {
  t.is(
    decode(BYTECODE_WITHOUT0X).ipfs,
    'QmbFc3AoHDC977j2UH2WwYSwsSRrBGj8bsiiyigXhHzyuZ'
  );
});

test('bytecode decode should fail gracefully when input is corrupted', (t) => {
  try {
    decode(BYTECODE_WRONG);
  } catch (e) {
    t.is((e as Error).message, 'Auxdata is not in the execution bytecode');
  }
});
