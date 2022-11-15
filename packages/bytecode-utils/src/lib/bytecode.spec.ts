import { readFileSync } from 'fs';

import test from 'ava';
import provider from 'eth-provider';

import { decode, get } from './bytecode';

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

test("get contract's bytecode by address and provider", async (t) => {
  const ethereumProvider = provider('https://eth-mainnet.public.blastapi.io');
  t.is(
    await get('0x00000000219ab540356cBB839Cbe05303d7705Fa', ethereumProvider),
    BYTECODE_IPFS
  );
});

test("should fail getting contract's bytecode by address and provider", async (t) => {
  const ethereumProvider = provider();
  try {
    await get('0x00000000219ab540356cBB839Cbe05303d7705Fa', ethereumProvider);
  } catch (e) {
    t.is((e as Error).message, 'Not connected');
  }
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

test('bytecode decode should fail gracefully when input is without 0x', (t) => {
  try {
    decode(BYTECODE_WITHOUT0X);
  } catch (e) {
    t.is((e as Error).message, 'Bytecode should start with 0x');
  }
});

test('bytecode decode should fail gracefully when input is corrupted', (t) => {
  try {
    decode(BYTECODE_WRONG);
  } catch (e) {
    t.is((e as Error).message, 'Data read, but end of buffer not reached');
  }
});
