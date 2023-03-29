declare let describe: unknown | any;
declare let it: unknown | any;

import { expect } from 'chai';
import {
  getSolcExecutable,
  getSolcJs,
  useCompiler,
} from '../src/lib/solidityCompiler';
import {
  CheckedContract,
  getGithubUrl,
  performFetch,
} from '../src/lib/CheckedContract';
import storageMetadata from './sources/Storage/metadata.json';
import { Metadata, MissingSources } from '../src/lib/types';
import fs from 'fs';
import path from 'path';

describe('Verify Solidity Compiler', () => {
  it('Should fetch latest SolcJS compiler', async () => {
    fs.rmdirSync(process.env.SOLC_REPO || path.join('/tmp', 'solc-repo'));
    expect(await getSolcJs()).not.equals(null);
  });
  it('Should fetch SolcJS compiler passing only version', async () => {
    fs.rmdirSync(process.env.SOLJSON_REPO || path.join('/tmp', 'soljson-repo'));
    expect(await getSolcJs('0.8.17+commit.8df45f5f')).not.equals(false);
  });
  if (process.platform === 'linux') {
    it('Should fetch latest solc from github', async () => {
      expect(
        await getSolcExecutable('linux-amd64', '0.8.9+commit.e5eed63a')
      ).not.equals(null);
    });
    it('Should compile with solc', async () => {
      try {
        const compiledJSON = await useCompiler('0.8.9+commit.e5eed63a', {
          language: 'Solidity',
          sources: {
            'test.sol': {
              content: 'contract C { function f() public  {} }',
            },
          },
          settings: {
            outputSelection: {
              '*': {
                '*': ['*'],
              },
            },
          },
        });
        expect(compiledJSON?.contracts?.['test.sol']?.C).to.not.equals(
          undefined
        );
      } catch (e: any) {
        expect.fail(e.message);
      }
    });
  }
  it('Should return a compiler error', async () => {
    try {
      await useCompiler('0.8.9+commit.e5eed63a', {
        language: 'Solidity',
        sources: {
          'test.sol': {
            content: 'contract C { function f() public  } }',
          },
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['*'],
            },
          },
        },
      });
    } catch (e: any) {
      expect(e.message.startsWith('Compiler error:')).to.be.true;
    }
  });
  it('Should compile with solcjs', async () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'not existing platform',
      writable: false,
    });
    try {
      const compiledJSON = await useCompiler('0.8.9+commit.e5eed63a', {
        language: 'Solidity',
        sources: {
          'test.sol': {
            content: 'contract C { function f() public  {} }',
          },
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['*'],
            },
          },
        },
      });
      expect(compiledJSON?.contracts?.['test.sol']?.C).to.not.equals(undefined);
    } catch (e: any) {
      expect.fail(e.message);
    } finally {
      Object.defineProperty(process, 'platform', {
        value: realPlatform,
        writable: false,
      });
    }
  });
});

describe('Checked contract', () => {
  it('Should return null after failed performFetch', async () => {
    expect(await performFetch('httpx://')).to.equal(null);
  });
  it('Should fail performFetch because mismatching keccak256', async () => {
    expect(
      await performFetch(
        'https://ipfs.io/ipfs/QmTkSBN1QffhGKwx365m5va6Pikz3pUJcAfaSRybkeCCDr',
        '0x00'
      )
    ).equals(null);
  });
  it('Should performFetch', async () => {
    expect(
      await performFetch(
        'https://ipfs.io/ipfs/QmTkSBN1QffhGKwx365m5va6Pikz3pUJcAfaSRybkeCCDr',
        '0xe76037d6a371fa3a073db88b7b76c371e0ab601be742fa1b089a74b996e360be'
      )
    ).to.not.equal(null);
  });
  it('Should fail getGithubUrl', async () => {
    expect(await getGithubUrl('github1.com')).to.equal(null);
  });
  it('Should getGithubUrl', async () => {
    const rawGithubUrl = await getGithubUrl(
      'https://github.com/ethereum/solc-bin/blob/gh-pages/linux-amd64/solc-linux-amd64-v0.8.12%2Bcommit.f00d7308'
    );
    expect(rawGithubUrl).equals(
      'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/linux-amd64/solc-linux-amd64-v0.8.12%2Bcommit.f00d7308'
    );
  });
  it('Should fetch missing files from checked contract', async () => {
    const missingSources: MissingSources = {};
    missingSources['Storage.sol'] = {
      keccak256:
        '0x88c47206b5ec3d60ab820e9d126c4ac54cb17fa7396ff49ebe27db2862982ad8',
      urls: ['dweb:/ipfs/QmaFRC9ZtT7y3t9XNWCbDuMTEwKkyaQJzYFzw3NbeohSn5'],
    };
    const contract = new CheckedContract(
      storageMetadata as any as Metadata,
      {},
      missingSources,
      {}
    );
    await CheckedContract.fetchMissing(contract);
    const sources = Object.keys(contract.solidity);
    expect(sources).lengthOf(1);
    expect(sources[0]).equals('Storage.sol');
  });
});
