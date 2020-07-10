/*
 * This is a module that uses a database dump of contract addresses and their deployed
 * bytecode in the format
 *
 * {"000028ece24bca7ecd9615bef14cbf3720b7f1b87d095680bae61b6c6db5feb3":"0x8b88a39383c90000bf8be57b8abfd59a6256b2e2"}
 * {"000034301b5c8f4049d759092cd11904f589d73e6283bc2ea1e27d3eadb84a84":"0x7ace493e27423bf13406e2b3ebe96aace38ae032"}
 *
 * (the first field is the keccak256-hash of the bytecode, the second is the address).
 *
 * The file has to be sorted and the field widths have to match exactly (i.e. the bytecode hash cannot
 * have a "0x" prefix but the address has to have it).
 */

// TODO make the file name configurable.

import fs from 'fs';
import util from 'util';
import Web3 from 'web3';

const log = console.log;
const dbFile : string = '/db/addressDB.txt';
const lineLength : number = 114; // including newline
const hashStart : number = 2;
const addressStart : number = 71; // after the "0x"

let fd : number;
let numRecords : number;

const stat = util.promisify(fs.stat);
const open = util.promisify(fs.open);
const read = util.promisify(fs.read);

async function setup() {
  numRecords = (await stat(dbFile)).size / lineLength;
  log(`Number of contracts in address/bytecode database: ${numRecords}`);
  fd = await open(dbFile, 'r');
  log("Database ready.");
}

async function readRecord(i: number) {
  const buffer = Buffer.alloc(lineLength);
  await read(fd, buffer, 0, buffer.length, i * lineLength);
  const data = buffer.toString();

  return {
    hash: data.substr(hashStart, 64).toLowerCase(),
    address: data.substr(addressStart, 40).toLowerCase()
  }
}

async function find(
  bytecodeHash: string,
  lower: number,
  upper: number
) : Promise<string[]>{

  if (lower >= upper) {
    return []
  }

  const mid = lower + Math.floor((upper - lower) / 2);
  const rec = await readRecord(mid);
  let addresses = [];

  if (bytecodeHash == rec.hash) {
    addresses.push(Web3.utils.toChecksumAddress(rec.address));
  }

  if (bytecodeHash >= rec.hash) {
    addresses = addresses.concat(await find(bytecodeHash, mid + 1, upper));
  }
  if (bytecodeHash <= rec.hash) {
    addresses = addresses.concat(await find(bytecodeHash, lower, mid));
  }

  return addresses;
}

async function findByHash(bytecodeHash : string) : Promise<string[]> {
  if (!fd)
    await setup();

  if (bytecodeHash.substr(0, 2) == '0x') {
    bytecodeHash = bytecodeHash.substr(2);
  }
  bytecodeHash = bytecodeHash.toLowerCase();
  return await find(bytecodeHash, 0, numRecords);
}


export async function findAddresses(
  chain: string,
  bytecode: string
) : Promise<string[]> {

  if (!fd) {
    try {
      await setup();
    } catch (e) {
      log("Address DB setup error:");
      log(e);
    }
  }
  if (!fd) {
    return [];
  }

  if (chain != 'mainnet') {
    return [];
  }

  if (bytecode.substr(0, 2) != '0x') {
    bytecode = `0x${bytecode}`;
  }

  const bytecodeHash = Web3.utils.keccak256(bytecode);
  return await findByHash(bytecodeHash);
}
