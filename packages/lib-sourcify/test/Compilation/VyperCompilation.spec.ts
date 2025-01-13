import { describe, it } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import { VyperCompilation } from '../../src/Compilation/VyperCompilation';
import { vyperCompiler } from '../utils';

describe.only('VyperCompilation', () => {
  it('should compile a simple Vyper contract', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractFileName = 'test.vy';
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    const compilation = new VyperCompilation(
      vyperCompiler,
      '0.3.10+commit.91361694',
      {
        language: 'Vyper',
        sources: {
          [contractFileName]: {
            content: contractContent,
          },
        },
        settings: {
          evmVersion: 'istanbul',
          outputSelection: {
            '*': ['evm.bytecode'],
          },
        },
      },
      {
        name: contractFileName.split('.')[0],
        path: contractFileName,
      },
    );

    await compilation.compile();
    expect(compilation.getCreationBytecode()).to.not.be.undefined;
    expect(compilation.getRuntimeBytecode()).to.not.be.undefined;
  });

  it('should handle immutable references correctly', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'withImmutables',
    );
    const contractFileName = 'test.vy';
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    const compilation = new VyperCompilation(
      vyperCompiler,
      '0.4.0+commit.e9db8d9f',
      {
        language: 'Vyper',
        sources: {
          [contractFileName]: {
            content: contractContent,
          },
        },
        settings: {
          evmVersion: 'london',
          outputSelection: {
            '*': ['evm.bytecode'],
          },
        },
      },
      {
        name: contractFileName.split('.')[0],
        path: contractFileName,
      },
    );

    await compilation.compile();
    expect(compilation.getImmutableReferences()).to.not.be.empty;
  });

  it('should generate correct CBOR auxdata positions', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractFileName = 'test.vy';
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    const compilation = new VyperCompilation(
      vyperCompiler,
      '0.3.10+commit.91361694',
      {
        language: 'Vyper',
        sources: {
          [contractFileName]: {
            content: contractContent,
          },
        },
        settings: {
          evmVersion: 'istanbul',
          outputSelection: {
            '*': ['evm.bytecode'],
          },
        },
      },
      {
        name: contractFileName.split('.')[0],
        path: contractFileName,
      },
    );

    await compilation.compile();
    const success = await compilation.generateCborAuxdataPositions();
    expect(success).to.be.true;
    expect(compilation.creationBytecodeCborAuxdata).to.not.be.empty;
  });

  it('should handle different Vyper versions correctly', async () => {
    const versions = [
      '0.3.4+commit.f31f0ec4',
      '0.3.7+commit.6020b8bb',
      '0.3.10+commit.91361694',
    ];

    for (const version of versions) {
      const contractPath = path.join(
        __dirname,
        '..',
        'sources',
        'Vyper',
        'testcontract',
      );
      const contractFileName = 'test.vy';
      const contractContent = fs.readFileSync(
        path.join(contractPath, contractFileName),
        'utf8',
      );

      const compilation = new VyperCompilation(
        vyperCompiler,
        version,
        {
          language: 'Vyper',
          sources: {
            [contractFileName]: {
              content: contractContent,
            },
          },
          settings: {
            evmVersion: 'istanbul',
            outputSelection: {
              '*': ['evm.bytecode'],
            },
          },
        },
        {
          name: contractFileName.split('.')[0],
          path: contractFileName,
        },
      );

      await compilation.compile();
      expect(compilation.getCreationBytecode()).to.not.be.undefined;
      expect(compilation.getRuntimeBytecode()).to.not.be.undefined;
    }
  });
});
