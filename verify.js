#!/usr/bin/env node

'use strict';

if (process.argv.length < 4) {
    console.log("Usage: testVerification.js <contract address> <call payload data>")
    process.exit(1)
}

let Web3 = require('web3')
let cbor = require('cbor')
let request = require('request-promise-native')
let solc = require('solc')

var exports = module.exports = {}

let cborDecode = function(bytecode)
{
    let cborLength = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1]
    return cbor.decodeFirstSync(new Buffer(bytecode.slice(bytecode.length - 2 - cborLength, -2)))
}

let retrieveSingleSource = async function(name, urls)
{
    console.log(" - " + name)
    for (var url of urls) {
        if (url.startsWith('bzz-raw')) {
            console.log("    (via swarm: " + url + ")")
            return await request('https://swarm-gateways.net/' + url)
        }
        // TODO also try ipfs
    }
    throw "Source " + name + " could not be found."
}
let retrieveSources = async function(sources)
{
    var output = {}
    for (var s in sources) {
        // TODO support literals sources
        output[s] = await retrieveSingleSource(s, sources[s]['urls'])
    }
    return output
}

let getBytecodeMetadataAndSources = async function(web3, address) {
    address = web3.utils.toChecksumAddress(address)
    console.log("Retrieving bytecode of contract at address " + address + "...")
    let bytecode = await web3.eth.getCode(address)
    let cborData = cborDecode(web3.utils.hexToBytes(bytecode))
    console.log(
        "Contract compiled with Solidity " +
        (cborData['solc'][0]) + "." +
        (cborData['solc'][1]) + "." +
        (cborData['solc'][2])
    )
    let metadataBzzr1 = web3.utils.bytesToHex(cborData['bzzr1']).slice(2)
    console.log("Retrieving metadata from swarm gateway. Hash: " + metadataBzzr1)
    let metadataRaw = await request('https://swarm-gateways.net/bzz-raw:/' + metadataBzzr1)
    let metadata = JSON.parse(metadataRaw)
    console.log("Retrieving sources...")
    let sources = await retrieveSources(metadata.sources)
    console.log("Have everything needed to verify compilation.")
    return {bytecode: bytecode, metadataRaw: metadataRaw, metadata: metadata, sources: sources}

};


let reformatMetadata = function(metadata, sources) {
    let input = {}
    input['settings'] = metadata['settings']
    let fileName = ''
    let contractName = ''
    for (fileName in metadata['settings']['compilationTarget'])
        contractName = metadata['settings']['compilationTarget'][fileName]
    delete input['settings']['compilationTarget']

    input['sources'] = {}
    for (var source in sources)
        input['sources'][source] = {'content': sources[source]}
    input['language'] = metadata['language']
    input['settings']['metadata'] = input['settings']['metadata'] || {}
    input['settings']['outputSelection'] = input['settings']['outputSelection'] || {}
    input['settings']['outputSelection'][fileName] = input['settings']['outputSelection'][fileName] || {}
    input['settings']['outputSelection'][fileName][contractName] = ['evm.bytecode', 'evm.deployedBytecode', 'metadata']

    return {
        input: input,
        fileName: fileName,
        contractName: contractName
    }
}

let recompile = async function(metadata, sources) {
    let reformatted = reformatMetadata(metadata, sources)
    let input = reformatted.input
    let fileName = reformatted.fileName
    let contractName = reformatted.contractName

    console.log('Re-compiling ' + fileName + ':' + contractName + ' with Solidity ' + metadata['compiler']['version'])
    console.log('Retrieving compiler...')
    let solcjs = await new Promise((resolve, reject) => {
        solc.loadRemoteVersion('v' + metadata['compiler']['version'], (error, soljson) => {
            if (error) {
                reject()
            } else {
                resolve(soljson)
            }
        })
    })
    console.log('Compiling...');0x8018280076d7fa2caa1147e441352e8a89e1ddbe
    let output = JSON.parse(solcjs.compile(JSON.stringify(input)));
    return {
        bytecode: output['contracts'][fileName][contractName]['evm']['bytecode']['object'],
        deployedBytecode: '0x' + output['contracts'][fileName][contractName]['evm']['deployedBytecode']['object'],
        metadata: output['contracts'][fileName][contractName]['metadata'].trim()
    }
}

let web3 = new Web3('https://ropsten.infura.io/v3/891fe57328084fcca24912b662ad101f')

let run = async function(addr, payload)
{
    let data = await getBytecodeMetadataAndSources(web3, addr)
    let output = await recompile(data.metadata, data.sources)
    if (output.metadata == data.metadataRaw) {
        console.log("Metadata matches!")
    } else {
        console.log("Metadata does NOT match!")
        console.log("From chain:")
        console.log(data.metadataRaw)
        console.log("After recompilation:")
        console.log(output.metadata)
        process.exit(1)
    }
    if (output.deployedBytecode == data.bytecode) {
        console.log("Deployed bytecode matches! (Note that constructor can still be different!)")
    } else {
        console.log("Deployed bytecode does NOT match!")
        console.log("From chain:")
        console.log(data.bytecode)
        console.log("After recompilation:")
        console.log(output.deployedBytecode)
        process.exit(1)
    }

    console.log('')

    if (payload.substr(0, 2) == '0x') {E

0x8018280076d7fA2cAa1147e441352E8a89e1DDbe
TutAboutApi

Code

Json

Asm

Abi

Data



#
#  Eveem.org 26 Apr 2019 
#  Decompiled source of 0x8018280076d7fA2cAa1147e441352E8a89e1DDbe
# 
#  Let's make the world open source 
# 
#
#  I failed with these: 
#  - unknown00000001(?)
#  All the rest is below.
#

def storage:
  unknownb1fbe72d is mapping of addr at storage 0
  stor50 is uint256 at storage 50
  stor51 is uint256 at storage 51

def unknownb1fbe72d(uint256 _param1): # not payable
  return unknownb1fbe72d[_param1]

#
#  Regular functions
#

def unknown3ca62eee(): # not payable
  stop

def _fallback() payable: # default function
  revert 

def unknown1e1763d3(): # not payable
  return (stor51 - stor50)

def unknown60b25bb7(): # not payable
  idx = 0
  while idx < 53:
      create contract with 0 wei
                      code: 0, 115, Mask(104, 0, this.address), 0
      idx = idx + 1
      continue 
  stor51 += 53

def withdraw(uint256 _amount): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  if _amount > 0:
      call caller with:
         value _amount wei
           gas 2300 * is_zero(value) wei
      require ext_call.success

def unknown2a971507(uint8 _param1): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  delegate unknownb1fbe72d[_param1 << 248].deposit(uint256 param1) with:
       gas gas_remaining - 25710 wei
      args Mask(248, 0, _param1)

def unknown32f91484(uint8 _param1): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  delegate unknownb1fbe72d[_param1 << 248].withdraw(uint256 wdamount) with:
       gas gas_remaining - 25710 wei
      args Mask(248, 0, _param1)

def withdrawTokens(address _token): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  call _token.balanceOf(address owner) with:
       gas gas_remaining wei
      args this.address
  call _token.transfer(address to, uint256 value) with:
       gas gas_remaining wei
      args tx.origin, ext_call.return_data[0]

def approve(address _token, address _proxy): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  require ext_code.size(_token)
  call _token.approve(address spender, uint256 value) with:
       gas gas_remaining - 710 wei
      args addr(_proxy), 0
  require ext_call.success
  require ext_code.size(_token)
  call _token.approve(address spender, uint256 value) with:
       gas gas_remaining - 710 wei
      args addr(_proxy), -1
  require ext_call.success
  require ext_call.return_data[0]

def unknown089c67be(array _param1): # not payable
  mem[128 len 32 * _param1.length] = call.data[_param1 + 36 len 32 * _param1.length]
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  idx = 1
  while idx < _param1.length + 1:
      require idx - 1 < _param1.length
      mem[0] = idx
      mem[32] = 0
      unknownb1fbe72d[idx] = mem[(32 * idx - 1) + 140 len 20]
      idx = idx + 1
      continue 

def unknowne7ec7343(bool _param1): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  if _param1:
      if stor51 - stor50 >= 1:
          idx = stor50 + 1
          while idx <= stor50 + 1:
              if idx > 65535:
                  mem[90] = idx
                  mem[87] = 131
                  mem[86] = this.address
                  mem[66] = 55700
                  call addr(sha3(55700, this.address, 0, idx % 16777216)) with:
                       gas gas_remaining - 25710 wei
              else:
                  if idx > 255:
                      mem[89] = idx
                      mem[87] = 130
                      mem[86] = this.address
                      mem[66] = 55444
                      call addr(sha3(55444, this.address, 0, uint16(idx))) with:
                           gas gas_remaining - 25710 wei
                  else:
                      if idx <= 127:
                          mem[87] = idx
                          mem[86] = this.address
                          mem[66] = 54932
                          call addr(sha3(54932, this.address, uint8(idx))) with:
                               gas gas_remaining - 25710 wei
                      else:
                          mem[88] = idx
                          mem[87] = 129
                          mem[86] = this.address
                          mem[66] = 55188
                          call addr(sha3(55188, this.address, 0, uint8(idx))) with:
                               gas gas_remaining - 25710 wei
              idx = idx + 1
              continue 
          stor50++E

0x8018280076d7fA2cAa1147e441352E8a89e1DDbe
TutAboutApi

Code

Json

Asm

Abi

Data



#
#  Eveem.org 26 Apr 2019 
#  Decompiled source of 0x8018280076d7fA2cAa1147e441352E8a89e1DDbe
# 
#  Let's make the world open source 
# 
#
#  I failed with these: 
#  - unknown00000001(?)
#  All the rest is below.
#

def storage:
  unknownb1fbe72d is mapping of addr at storage 0
  stor50 is uint256 at storage 50
  stor51 is uint256 at storage 51

def unknownb1fbe72d(uint256 _param1): # not payable
  return unknownb1fbe72d[_param1]

#
#  Regular functions
#

def unknown3ca62eee(): # not payable
  stop

def _fallback() payable: # default function
  revert 

def unknown1e1763d3(): # not payable
  return (stor51 - stor50)

def unknown60b25bb7(): # not payable
  idx = 0
  while idx < 53:
      create contract with 0 wei
                      code: 0, 115, Mask(104, 0, this.address), 0
      idx = idx + 1
      continue 
  stor51 += 53

def withdraw(uint256 _amount): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  if _amount > 0:
      call caller with:
         value _amount wei
           gas 2300 * is_zero(value) wei
      require ext_call.success

def unknown2a971507(uint8 _param1): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  delegate unknownb1fbe72d[_param1 << 248].deposit(uint256 param1) with:
       gas gas_remaining - 25710 wei
      args Mask(248, 0, _param1)

def unknown32f91484(uint8 _param1): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  delegate unknownb1fbe72d[_param1 << 248].withdraw(uint256 wdamount) with:
       gas gas_remaining - 25710 wei
      args Mask(248, 0, _param1)

def withdrawTokens(address _token): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  call _token.balanceOf(address owner) with:
       gas gas_remaining wei
      args this.address
  call _token.transfer(address to, uint256 value) with:
       gas gas_remaining wei
      args tx.origin, ext_call.return_data[0]

def approve(address _token, address _proxy): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  require ext_code.size(_token)
  call _token.approve(address spender, uint256 value) with:
       gas gas_remaining - 710 wei
      args addr(_proxy), 0
  require ext_call.success
  require ext_code.size(_token)
  call _token.approve(address spender, uint256 value) with:
       gas gas_remaining - 710 wei
      args addr(_proxy), -1
  require ext_call.success
  require ext_call.return_data[0]

def unknown089c67be(array _param1): # not payable
  mem[128 len 32 * _param1.length] = call.data[_param1 + 36 len 32 * _param1.length]
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  idx = 1
  while idx < _param1.length + 1:
      require idx - 1 < _param1.length
      mem[0] = idx
      mem[32] = 0
      unknownb1fbe72d[idx] = mem[(32 * idx - 1) + 140 len 20]
      idx = idx + 1
      continue 

def unknowne7ec7343(bool _param1): # not payable
  if 0xff1b9745f68f84f036e5e92c920038d895fb701a != caller:
      if 0xff28319a7cd2136ea7283e7cdb0675b50ac29dd2 != caller:
          if 0xff3769cdbd31893ef1b10a01ee0d8bd1f3773899 != caller:
              if 0xff49432a1ea8ac6d12285099ba426d1f16f23c8d != caller:
                  if 0xff59364722a4622a8d33623548926375b1b07767 != caller:
                      if 0xff6d62bc882c2fca5af5cbfe1e6c10b97ba251a4 != caller:
                          if 0xff7baf00edf054e249e9f498aa51d1934b8d3526 != caller:
                              if 0xff86c0aa0cc44c3b054c5fdb25f85d555c1d2c3a != caller:
                                  if 0xff910355ad1d3d12e8be75a512553e479726ab45 != caller:
                                      if 0xffa5bfe92b6791dad23c7837abb790b48c2f8995 != caller:
                                          if 0xffbfdb803d38d794b5785ee0ac09f83b429d11b5 != caller:
                                              if 0xffcdfd98c455c29818697ab2eeafccbc4e59fd3d != caller:
                                                  if 0xffdce1ae835d35bb603c95163e510bb2604a1a41 != caller:
                                                      if 0xffe1c5696d924438fba5274d7b5d8ffa29239a6f != caller:
                                                          if 0xfff66732389866aeaf8f7305da53f442c29e1b8f != caller:
                                                              if 0xfff804bd7487b4e2aadb32def0efc9c3127687a2 != caller:
                                                                  if 0xfffb0526a6eb87e85ba0bacb38dd5b53e9bfc097 != caller:
                                                                      if 0xfffc4a1c98687254c7cf6b1a3bc27db464f3600b != caller:
                                                                          if 0xfffdcbe1e77fbf1d0ba78fc39ce4ab0bf5c9f94c != caller:
                                                                              if 0xfffef0974279825a633a295d7ebc3f7afeb33c17 != caller:
                                                                                  require caller == 0xffff46e05a09314daae9176fc32dba0f4172dcdb
  require block.gas_limit < 20 * 10^6
  if _param1:
      if stor51 - stor50 >= 1:
          idx = stor50 + 1
          while idx <= stor50 + 1:
              if idx > 65535:
                  mem[90] = idx
                  mem[87] = 131
                  mem[86] = this.address
                  mem[66] = 55700
                  call addr(sha3(55700, this.address, 0, idx % 16777216)) with:
                       gas gas_remaining - 25710 wei
              else:
                  if idx > 255:
                      mem[89] = idx
                      mem[87] = 130
                      mem[86] = this.address
                      mem[66] = 55444
                      call addr(sha3(55444, this.address, 0, uint16(idx))) with:
                           gas gas_remaining - 25710 wei
                  else:
                      if idx <= 127:
                          mem[87] = idx
                          mem[86] = this.address
                          mem[66] = 54932
                          call addr(sha3(54932, this.address, uint8(idx))) with:
                               gas gas_remaining - 25710 wei
                      else:
                          mem[88] = idx
                          mem[87] = 129
                          mem[86] = this.address
                          mem[66] = 55188
                          call addr(sha3(55188, this.address, 0, uint8(idx))) with:
                               gas gas_remaining - 25710 wei
              idx = idx + 1
              continue 
          stor50++

        payload = payload.substr(2)
    }
    let userdoc = data.metadata['output']['userdoc']['methods']
    for (var signature in userdoc) {
        var selector = web3.utils.keccak256(signature).substr(2, 8)
        if (payload.substr(0, 8) == selector) {
            console.log("You are calling the function")
            console.log("  " + signature)
            console.log("Description: \"" + userdoc[signature]['notice'] + '\"')
            return
        }
    }
    console.log("Function with selector " + payload.substr(0, 8) + " not found!")
    console.log("Be careful with this transaction!")
    process.exit(1)
}

run(process.argv[2], process.argv[3])
    .catch(console.log)
