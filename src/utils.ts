import cbor from 'cbor';
import Web3 from 'web3';

const solc: any = require('solc');
const log = console.log;

declare type ReformattedMetadata = {
  input: any,
  fileName: string,
  contractName: string
}

export type RecompilationResult = {
  bytecode: string,
  deployedBytecode: string,
  metadata: string
}

export function cborDecode(bytecode: number[]) : Buffer {
  const cborLength : number = bytecode[bytecode.length - 2] * 0x100 + bytecode[bytecode.length - 1];
  const bytecodeBuffer = Buffer.from(bytecode.slice(bytecode.length - 2 - cborLength, -2));
  return cbor.decodeFirstSync(bytecodeBuffer);
}

export async function getBytecode(web3: Web3, address: string) {
  address = web3.utils.toChecksumAddress(address);
  log(`Retrieving bytecode of contract at address ${address}...`);
  return await web3.eth.getCode(address);
};

function reformatMetadata(metadata : any, sources : string[]) : ReformattedMetadata {
  const input : any = {};
  let fileName : string = '';
  let contractName : string = '';

  input.settings = metadata.settings;

  for (fileName in metadata.settings.compilationTarget){
    contractName = metadata.settings.compilationTarget[fileName];
  }

  delete input['settings']['compilationTarget']

  if (contractName == '') {
    throw new Error("Could not determine compilation target from metadata.");
  }

  input['sources'] = {}
  for (const source in sources){
    input.sources[source] = {'content': sources[source]}
  }

  input.language = metadata.language
  input.settings.metadata = input.settings.metadata || {}
  input.settings.outputSelection = input.settings.outputSelection || {}
  input.settings.outputSelection[fileName] = input.settings.outputSelection[fileName] || {}

  input.settings.outputSelection[fileName][contractName] = [
    'evm.bytecode',
    'evm.deployedBytecode',
    'metadata'
  ];

  return {
    input: input,
    fileName: fileName,
    contractName: contractName
  }
}

export async function recompile(metadata : any, sources : any) : Promise<RecompilationResult> {
  const reformatted = reformatMetadata(metadata, sources);
  const input = reformatted.input;
  const fileName = reformatted.fileName;
  const contractName = reformatted.contractName;
  const version = metadata.compiler.version;

  log(`Re-compiling ${fileName}:${contractName} with Solidity ${version}`);
  log('Retrieving compiler...');

  const solcjs: any = await new Promise((resolve, reject) => {
    solc.loadRemoteVersion(`v${version}`, (error: Error, soljson: any) => {
      (error) ? reject(error) : resolve(soljson);
    });
  })

  log('Compiling...');

  const compiled: any = solcjs.compile(JSON.stringify(input));
  const output = JSON.parse(compiled);
  const contract : any = output.contracts[fileName][contractName];

  return {
    bytecode: contract.evm.bytecode.object,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
    metadata: contract.metadata.trim()
  }
}

