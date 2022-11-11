import { readFileSync } from 'fs';

import test from 'ava';
import provider from 'eth-provider';

import { decode, get } from './bytecode';

const BYTECODES_FOLDER = './src/lib/bytecodes';
const BYTECODE_IPFS = readFileSync(`${BYTECODES_FOLDER}/ipfs.hex`).toString();
const BYTECODE_BZZR1 = readFileSync(`${BYTECODES_FOLDER}/bzzr1.hex`).toString();
const BYTECODE_WRONG = readFileSync(`${BYTECODES_FOLDER}/wrong.hex`).toString();
const BYTECODE_EXPERIMENTAL = readFileSync(
  `${BYTECODES_FOLDER}/experimental.hex`
).toString();

test("get contract's bytecode by adderss and provider", async (t) => {
  const ethereumProvider = provider('https://eth-mainnet.public.blastapi.io');
  t.is(
    await get('0x00000000219ab540356cBB839Cbe05303d7705Fa', ethereumProvider),
    BYTECODE_IPFS
  );
});

test("should fail getting contract's bytecode by adderss and provider", async (t) => {
  const ethereumProvider = provider();
  try {
    await get('0x00000000219ab540356cBB839Cbe05303d7705Fa', ethereumProvider);
  } catch (e: any) {
    t.is(e.message, 'Not connected');
  }
});

test('bytecode decode cbor with ipfs property', (t) => {
  t.is(
    decode(BYTECODE_IPFS).ipfs,
    'QmdD3hpMj6mEFVy9DP4QqjHaoeYbhKsYvApX1YZNfjTVWp'
  );
});

test('bytecode decode cbor with unknow property (bzzr1)', (t) => {
  t.is(
    decode(BYTECODE_BZZR1).bzzr1,
    '0x71e0c183217ae3e9a1406ae7b58c2f36e09f2b16b10e19d46ceb821f3ee6abad'
  );
});

test.only('bytecode decode cbor with experimental property', (t) => {
  t.is(decode(BYTECODE_EXPERIMENTAL).experimental, true);
});

test('bytecode decode should fail gracefully when input is undefined', (t) => {
  try {
    console.log(decode(''));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    t.is(e.message, 'Bytecode cannot be null');
  }
});

test('bytecode decode should fail gracefully when input is corrupted', (t) => {
  try {
    console.log(decode(BYTECODE_WRONG));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    t.is(e.message, 'Data read, but end of buffer not reached');
  }
});
