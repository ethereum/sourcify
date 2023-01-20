/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import { SourcifyChain } from '../src/lib/types';
import Web3 from 'web3';
import { expect } from 'chai';
import Ganache from 'ganache';
import { deployCheckAndVerify } from './utils';
import { describe, it, before } from 'mocha';

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
    const contractFolderPath = path.join(__dirname, 'sources', 'Storage');
    const match = await deployCheckAndVerify(
      contractFolderPath,
      sourcifyChainGanache,
      localWeb3Provider,
      accounts[0]
    );
    expect(match.status).to.equal('perfect');
  });

  it('should verify a contract with library placeholders', async () => {
    // Originally https://goerli.etherscan.io/address/0x399B23c75d8fd0b95E81E41e1c7c88937Ee18000#code
    const contractFolderPath = path.join(__dirname, 'sources', 'UsingLibrary');
    const match = await deployCheckAndVerify(
      contractFolderPath,
      sourcifyChainGanache,
      localWeb3Provider,
      accounts[0]
    );

    expect(match.status).to.equal('perfect');
    const expectedLibraryMap = {
      __$da572ae5e60c838574a0f88b27a0543803$__:
        '11fea6722e00ba9f43861a6e4da05fecdf9806b7',
    };
    expect(match.libraryMap).to.deep.equal(expectedLibraryMap);
  });

  it('should verify a contract with viaIR:true', async () => {
    const contractFolderPath = path.join(__dirname, 'sources', 'StorageViaIR');
    const match = await deployCheckAndVerify(
      contractFolderPath,
      sourcifyChainGanache,
      localWeb3Provider,
      accounts[0]
    );
    expect(match.status).to.equal('perfect');
  });
});
