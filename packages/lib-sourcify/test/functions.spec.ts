declare let describe: unknown | any;
declare let it: unknown | any;

import { expect } from 'chai';
import {
  getSolcExecutable,
  getSolcJs,
  useCompiler,
} from './compiler/solidityCompiler';
import {
  CheckedContract,
  getGithubUrl,
  getIpfsGateway,
  performFetch,
} from '../src/lib/CheckedContract';
import storageMetadata from './sources/Storage/metadata.json';
import { Metadata, MissingSources } from '../src/lib/types';
import WrongMetadata from './sources/WrongMetadata/metadata.json';
import SimplyLog from './sources/WrongMetadata/SimplyLog.json';
import earlyCompilerInput from './sources/json-input/pre-v0.4.0/input.json';
import { keccak256 } from 'ethers';
import { solc } from './utils';
import { fetchWithBackoff } from '../src/lib/utils';
import http from 'http';
import { Done } from 'mocha';
import { AddressInfo } from 'net';

describe('Verify Solidity Compiler', () => {
  it('Should fetch latest SolcJS compiler', async () => {
    expect(await getSolcJs()).not.equals(null);
  });
  it('Should fetch SolcJS compiler passing only version', async () => {
    expect(await getSolcJs('0.8.17+commit.8df45f5f')).not.equals(false);
  });
  it('Should fetch SolcJS compiler that is saved as a link in the repo', async () => {
    expect(await getSolcJs('v0.5.14+commit.1f1aaa4')).not.equals(false);
  });
  if (process.platform === 'linux') {
    it('Should fetch latest solc from github', async () => {
      expect(
        await getSolcExecutable('linux-amd64', '0.8.9+commit.e5eed63a'),
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
          undefined,
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

  // See https://github.com/ethereum/sourcify/issues/1099
  it(`Should should use a clean compiler context with pre 0.4.0 versions`, async () => {
    // Run compiler once to change compiler "context"
    await useCompiler('0.1.5+commit.23865e3', earlyCompilerInput);

    // A second run needs to produce the same result
    const compilerResult = await useCompiler(
      '0.1.5+commit.23865e3',
      earlyCompilerInput,
    );
    const compiledBytecode = compilerResult?.contracts['']?.GroveLib?.evm
      ?.deployedBytecode?.object as string;
    const compiledHash = keccak256('0x' + compiledBytecode);
    expect(compiledHash).equals(
      '0xc778f3d42ce4a7ee21a2e93d45265cf771e5970e0e36f882310f4491d0ca889d',
    );
  });
});

describe('Checked contract', () => {
  it('Should return null after failed performFetch', async () => {
    expect(await performFetch('httpx://')).to.equal(null);
  });
  it('Should call fetchWithBackoff with headers', (done: Done) => {
    const server = http.createServer((req) => {
      expect(req.headers['test']).to.equal('test');
      server.close();
      done();
    });
    // Passing 0 assign first available port
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      fetchWithBackoff(`http://localhost:${port}`, {
        test: 'test',
      });
    });
  });
  it('Should return getIpfsGateway with headers', async () => {
    process.env.IPFS_GATEWAY_HEADERS = `{ "test": "test" }`;
    const ipfsGateway = getIpfsGateway();
    expect(ipfsGateway.headers).to.deep.equal({
      test: 'test',
    });
  });
  it('Should fail performFetch because mismatching keccak256', async () => {
    const ipfsGateway = getIpfsGateway();
    expect(
      await performFetch(
        ipfsGateway.url +
          '/ipfs/QmTkSBN1QffhGKwx365m5va6Pikz3pUJcAfaSRybkeCCDr',
        '0x00',
      ),
    ).equals(null);
  });
  it('Should performFetch', async () => {
    const ipfsGateway = getIpfsGateway();
    expect(
      await performFetch(
        ipfsGateway.url +
          '/ipfs/QmTkSBN1QffhGKwx365m5va6Pikz3pUJcAfaSRybkeCCDr',
        '0xe76037d6a371fa3a073db88b7b76c371e0ab601be742fa1b089a74b996e360be',
      ),
    ).to.not.equal(null);
  });
  it('Should fail getGithubUrl', async () => {
    expect(await getGithubUrl('github1.com')).to.equal(null);
  });
  it('Should getGithubUrl', async () => {
    const rawGithubUrl = await getGithubUrl(
      'https://github.com/ethereum/solc-bin/blob/gh-pages/linux-amd64/solc-linux-amd64-v0.8.12%2Bcommit.f00d7308',
    );
    expect(rawGithubUrl).equals(
      'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/linux-amd64/solc-linux-amd64-v0.8.12%2Bcommit.f00d7308',
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
      solc,
      storageMetadata as any as Metadata,
      {},
      missingSources,
      {},
    );
    await CheckedContract.fetchMissing(contract);
    const sources = Object.keys(contract.solidity);
    expect(sources).lengthOf(1);
    expect(sources[0]).equals('Storage.sol');
  });
  it('Should tryToFindPerfectMetadata from checked contract', async () => {
    const contract = new CheckedContract(solc, WrongMetadata as Metadata, {
      'SimplyLog.sol': SimplyLog.source,
    });

    const contractWithPerfectMetadata = await contract.tryToFindPerfectMetadata(
      SimplyLog.bytecode,
    );
    expect(contractWithPerfectMetadata).is.not.equal(null);
    expect(
      contractWithPerfectMetadata?.metadata?.sources['SimplyLog.sol']
        ?.keccak256,
    ).equals(
      '0x8e7a1207ba791693fd76c6cf3e99908f53b8c67a5ae9f7b4ab628c74901711c9',
    );
  });
});
