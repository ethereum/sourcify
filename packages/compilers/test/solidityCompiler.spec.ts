import { expect } from 'chai';
import {
  getSolcExecutable,
  getSolcJs,
  useSolidityCompiler,
} from '../src/lib/solidityCompiler';
import earlyCompilerInput from './utils/pre-v0.4.0-input.json';
import { keccak256 } from 'ethers';
import path from 'path';

describe('Verify Solidity Compiler', () => {
  const compilersPath = path.join('/tmp', 'solc-repo');
  const solJsonRepo = path.join('/tmp', 'soljson-repo');

  it('Should fetch latest SolcJS compiler', async () => {
    expect(await getSolcJs(solJsonRepo, 'latest')).not.equals(null);
  });
  it('Should fetch SolcJS compiler passing only version', async () => {
    expect(await getSolcJs(solJsonRepo, '0.8.17+commit.8df45f5f')).not.equals(
      false,
    );
  });
  it('Should fetch SolcJS compiler that is saved as a link in the repo', async () => {
    expect(await getSolcJs(solJsonRepo, 'v0.5.14+commit.1f1aaa4')).not.equals(
      false,
    );
  });
  if (process.platform === 'linux') {
    it('Should fetch latest solc from github', async () => {
      expect(
        await getSolcExecutable(
          compilersPath,
          'linux-amd64',
          '0.8.9+commit.e5eed63a',
        ),
      ).not.equals(null);
    });
    it('Should compile with solc', async () => {
      try {
        const compiledJSON = await useSolidityCompiler(
          compilersPath,
          solJsonRepo,
          '0.8.9+commit.e5eed63a',
          {
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
          },
        );
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
      await useSolidityCompiler(
        compilersPath,
        solJsonRepo,
        '0.8.9+commit.e5eed63a',
        {
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
        },
      );
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
      const compiledJSON = await useSolidityCompiler(
        compilersPath,
        solJsonRepo,
        '0.8.9+commit.e5eed63a',
        {
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
        },
      );
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
    await useSolidityCompiler(
      compilersPath,
      solJsonRepo,
      '0.1.5+commit.23865e3',
      earlyCompilerInput,
    );

    // A second run needs to produce the same result
    const compilerResult = await useSolidityCompiler(
      compilersPath,
      solJsonRepo,
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
