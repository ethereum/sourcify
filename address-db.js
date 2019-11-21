'use strict';

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

const fs = require('fs')
const util = require('util');

const Web3 = require('web3')

const dbFile = './addressDB.txt'
const lineLength = 114 // including newline
const hashStart = 2
const addressStart = 71 // after the "0x"

let fd
let numRecords

const stat = util.promisify(fs.stat)
const open = util.promisify(fs.open)
const read = util.promisify(fs.read)

let setup = async function() {
    numRecords = (await stat(dbFile)).size / lineLength
    console.log("Number of contracts in address/bytecode database: " + numRecords)
    fd = await open(dbFile, 'r')
    console.log("Database ready.")
}

let readRecord = async function(i) {
    let buffer = new Buffer(lineLength)
    await read(fd, buffer, 0, buffer.length, i * lineLength)
    let data = buffer.toString()
    return {hash: data.substr(hashStart, 64).toLowerCase(), address: data.substr(addressStart, 40).toLowerCase()}
}

let find = async function(bytecodeHash, lower, upper) {
    if (lower >= upper) {
        return []
    }
    let mid = lower + Math.floor((upper - lower) / 2)
    let rec = await readRecord(mid)
    let addresses = []
    if (bytecodeHash == rec.hash) {
        addresses.push(Web3.utils.toChecksumAddress(rec.address))
    }

    if (bytecodeHash >= rec.hash) {
        addresses = addresses.concat(await find(bytecodeHash, mid + 1, upper))
    }
    if (bytecodeHash <= rec.hash) {
        addresses = addresses.concat(await find(bytecodeHash, lower, mid))
    }
    return addresses
}

let findByHash = async function(bytecodeHash) {
    if (!fd)
        await setup()

    if (bytecodeHash.substr(0, 2) == '0x') {
        bytecodeHash = bytecodeHash.substr(2)
    }
    bytecodeHash = bytecodeHash.toLowerCase()
    return await find(bytecodeHash, 0, numRecords)
}

exports.findAddresses = async function(chain, bytecode) {
    if (!fd) {
        try {
            await setup()
        } catch {
        }
    }
    if (!fd) {
        return []
    }

    if (chain != 'mainnet') {
        return []
    }
    if (bytecode.substr(0, 2) != '0x') {
        bytecode = '0x' + bytecode
    }
    let bytecodeHash = Web3.utils.keccak256(bytecode)
    return await findByHash(bytecodeHash)
}