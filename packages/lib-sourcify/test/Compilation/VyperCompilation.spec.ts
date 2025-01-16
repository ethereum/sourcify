import { describe, it } from 'mocha';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import { VyperCompilation } from '../../src/Compilation/VyperCompilation';
import { vyperCompiler } from '../utils';

describe('VyperCompilation', () => {
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

  it('should handle vyper versions lower than 0.3.5', async () => {
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
      '0.3.4+commit.f31f0ec4',
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
    await compilation.generateCborAuxdataPositions();
    expect(compilation.getCreationBytecode()).to.not.be.undefined;
    expect(compilation.getRuntimeBytecode()).to.not.be.undefined;
  });

  it('should handle compilation errors gracefully', async () => {
    const invalidContent = 'invalid vyper code @123';
    const contractFileName = 'invalid.vy';

    const compilation = new VyperCompilation(
      vyperCompiler,
      '0.3.10+commit.91361694',
      {
        language: 'Vyper',
        sources: {
          [contractFileName]: {
            content: invalidContent,
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

    try {
      await compilation.compile();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.exist;
    }
  });

  it('should handle missing bytecode in compilation output', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractName = 'test';
    const contractFileName = `${contractName}.vy`;
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    // Mock vyperCompiler to return output without bytecode
    const mockCompiler = {
      compile: async () => ({
        contracts: {
          ['different' + contractFileName]: {
            ['different' + contractName]: {
              evm: {
                bytecode: {
                  object: '',
                },
              },
            },
          },
        },
      }),
    };

    const compilation = new VyperCompilation(
      mockCompiler as any,
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
        name: contractName,
        path: contractFileName,
      },
    );

    try {
      await compilation.compile();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).to.equal('Contract not found in compiler output');
    }
  });

  it('should handle errors in CBOR auxdata positions generation', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractName = 'test';
    const contractFileName = `${contractName}.vy`;
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    // Mock vyperCompiler to return output without metadata
    const mockCompiler = {
      compile: async () => ({
        contracts: {
          [contractFileName]: {
            [contractName]: {
              evm: {
                bytecode: {
                  object: '0x123456',
                },
              },
            },
          },
        },
      }),
    };

    const compilation = new VyperCompilation(
      mockCompiler as any,
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
        name: contractName,
        path: contractFileName,
      },
    );

    await compilation.compile();
    const success = await compilation.generateCborAuxdataPositions();
    expect(success).to.be.false;
  });

  it('should handle beta versions of Vyper', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractName = 'test';
    const contractFileName = `${contractName}.vy`;
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    // Mock vyperCompiler to return output without metadata
    const mockCompiler = {
      compile: async () => ({
        contracts: {
          [contractFileName]: {
            [contractName]: {
              evm: {
                bytecode: {
                  object: '0x123456',
                },
              },
            },
          },
        },
      }),
    };

    const compilation = new VyperCompilation(
      mockCompiler as any,
      '0.4.1b4+commit.4507d2a6',
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
        name: contractName,
        path: contractFileName,
      },
    );

    await compilation.compile();
    expect(compilation.compilerVersionCompatibleWithSemver).to.equal(
      '0.4.1+commit.4507d2a6',
    );
  });

  it('should throw error for invalid Vyper version format', () => {
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

    expect(
      () =>
        new VyperCompilation(
          vyperCompiler,
          'invalid.version.format', // Invalid version format
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
        ),
    ).to.throw('Invalid Vyper compiler version');
  });

  it('should handle bytecode decoding errors in getImmutableReferences', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractName = 'test';
    const contractFileName = `${contractName}.vy`;
    const contractContent = fs.readFileSync(
      path.join(contractPath, contractFileName),
      'utf8',
    );

    // Mock compiler to return invalid bytecode that will cause decode to fail
    const mockCompiler = {
      compile: async () => ({
        contracts: {
          [contractFileName]: {
            [contractName]: {
              evm: {
                bytecode: {
                  object: '0x1234', // Invalid/malformed bytecode
                },
                deployedBytecode: {
                  object: '0x5678',
                },
              },
            },
          },
        },
      }),
    };

    const compilation = new VyperCompilation(
      mockCompiler as any,
      '0.3.10+commit.91361694', // Using version >= 0.3.10 to trigger immutable reference check
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
        name: contractName,
        path: contractFileName,
      },
    );

    await compilation.compile();
    const immutableRefs = compilation.getImmutableReferences();
    expect(immutableRefs).to.be.empty;
  });

  it('should handle runtime bytecode CBOR auxdata based on Vyper version', async () => {
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

    // Test with version < 0.3.10
    const compilation = new VyperCompilation(
      vyperCompiler,
      '0.3.7+commit.6020b8bb',
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
    await compilation.generateCborAuxdataPositions();
    expect(compilation.runtimeBytecodeCborAuxdata).to.not.be.empty;
  });
});
