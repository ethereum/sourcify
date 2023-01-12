import { verifyDeployed } from '../src';
import { checkFiles } from '../src';
import fs from 'fs';
import path from 'path';
import { SourcifyChain } from '../src/lib/types';
import Web3 from 'web3';
import { expect } from 'chai';
import Ganache from 'ganache';
import { deployFromAbiAndBytecode } from './utils';

const ganacheServer = Ganache.server({
  wallet: { totalAccounts: 1 },
  chain: { chainId: 0, networkId: 0 },
});
const GANACHE_PORT = 8545;

const sourcifyChainGanache: SourcifyChain = {
  name: 'ganache',
  shortName: 'ganache',
  chainId: 0,
  networkId: 0,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpc: [`http://localhost:${GANACHE_PORT}`],
  monitored: false,
  supported: true,
};

let localWeb3Provider: Web3;
let accounts: string[];

describe('Verify Deployed Contract', () => {
  before(async () => {
    await ganacheServer.listen(GANACHE_PORT);
    localWeb3Provider = new Web3(`http://localhost:${GANACHE_PORT}`);
    accounts = await localWeb3Provider.eth.getAccounts();
  });

  it('should verify a simple contract', async () => {
    // Deploy contract
    const artifact = require('./testcontracts/Storage/Storage.json');
    const metadata = require('./testcontracts/Storage/metadata.json');
    const address = await deployFromAbiAndBytecode(
      localWeb3Provider,
      metadata.output.abi,
      artifact.bytecode,
      accounts[0]
    );

    // Verify contract
    const sourcePath = path.join(__dirname, 'sources', 'simple', 'Storage.sol');
    const metadataPath = path.join(
      __dirname,
      'sources',
      'simple',
      'metadata.json'
    );
    const sourceBuffer = fs.readFileSync(sourcePath);
    const metadataBuffer = fs.readFileSync(metadataPath);
    const checkedContracts = checkFiles([
      { path: sourcePath, buffer: sourceBuffer },
      { path: metadataPath, buffer: metadataBuffer },
    ]);
    const verified = await verifyDeployed(
      checkedContracts[0],
      sourcifyChainGanache,
      address
    );

    expect(verified.status).to.equal('perfect');
  });
});
