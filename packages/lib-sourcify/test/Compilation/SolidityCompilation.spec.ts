import { describe, it } from 'mocha';
import { expect, use } from 'chai';
import path from 'path';
import fs from 'fs';
import { SolidityCompilation } from '../../src/Compilation/SolidityCompilation';
import { solc } from '../utils';
import {
  CompilationTarget,
  Metadata,
} from '../../src/Compilation/CompilationTypes';
import { SolidityJsonInput } from '../../src/Compilation/SolidityTypes';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

function getSolcSettingsFromMetadata(metadata: Metadata) {
  const metadataSettings = JSON.parse(JSON.stringify(metadata.settings));
  delete metadataSettings.compilationTarget;
  return metadataSettings;
}

function getCompilationTargetFromMetadata(
  metadata: Metadata,
): CompilationTarget {
  const path = Object.keys(metadata.settings.compilationTarget)[0];
  const name = metadata.settings.compilationTarget[path];
  return {
    name,
    path,
  };
}

describe.only('SolidityCompilation', () => {
  it('should compile a simple contract', async () => {
    const contractPath = path.join(__dirname, '..', 'sources', 'Storage');
    const metadata = JSON.parse(
      fs.readFileSync(path.join(contractPath, 'metadata.json'), 'utf8'),
    );
    const sources = {
      'project:/contracts/Storage.sol': {
        content: fs.readFileSync(
          path.join(contractPath, 'sources', 'Storage.sol'),
          'utf8',
        ),
      },
    };

    const compilation = new SolidityCompilation(
      solc,
      metadata.compiler.version,
      {
        language: 'Solidity',
        sources,
        settings: getSolcSettingsFromMetadata(metadata),
      },
      getCompilationTargetFromMetadata(metadata),
    );

    await compilation.compile();
    expect(compilation.getCreationBytecode()).to.not.be.undefined;
    expect(compilation.getRuntimeBytecode()).to.not.be.undefined;
  });

  it('should generate correct CBOR auxdata positions', async () => {
    const contractPath = path.join(__dirname, '..', 'sources', 'Storage');
    const metadata = JSON.parse(
      fs.readFileSync(path.join(contractPath, 'metadata.json'), 'utf8'),
    );
    const sources = {
      'project:/contracts/Storage.sol': {
        content: fs.readFileSync(
          path.join(contractPath, 'sources', 'Storage.sol'),
          'utf8',
        ),
      },
    };

    const compilation = new SolidityCompilation(
      solc,
      metadata.compiler.version,
      {
        language: 'Solidity',
        sources,
        settings: getSolcSettingsFromMetadata(metadata),
      },
      getCompilationTargetFromMetadata(metadata),
    );

    await compilation.compile();
    const success = await compilation.generateCborAuxdataPositions();
    expect(success).to.be.true;
    expect(compilation.runtimeBytecodeCborAuxdata).to.not.be.empty;
  });

  it('should handle multiple auxdatas correctly', async () => {
    const contractPath = path.join(
      __dirname,
      '..',
      'sources',
      'WithMultipleAuxdatas',
    );
    const metadata = JSON.parse(
      fs.readFileSync(path.join(contractPath, 'metadata.json'), 'utf8'),
    );

    // Need to read all source files referenced in metadata
    const sources: { [key: string]: { content: string } } = {};
    for (const [sourcePath] of Object.entries(metadata.sources)) {
      const fullPath = path.join(
        contractPath,
        'sources',
        path.basename(sourcePath),
      );
      sources[sourcePath] = {
        content: fs.readFileSync(fullPath, 'utf8'),
      };
    }

    const compilation = new SolidityCompilation(
      solc,
      metadata.compiler.version,
      {
        language: 'Solidity',
        sources,
        settings: getSolcSettingsFromMetadata(metadata),
      },
      getCompilationTargetFromMetadata(metadata),
    );

    await compilation.compile();
    const success = await compilation.generateCborAuxdataPositions();
    expect(success).to.be.true;

    console.log(compilation.runtimeBytecodeCborAuxdata);
    console.log(compilation.creationBytecodeCborAuxdata);
    expect(compilation.runtimeBytecodeCborAuxdata).to.not.be.undefined;
    expect(compilation.creationBytecodeCborAuxdata).to.not.be.undefined;
    expect(
      Object.keys(compilation.runtimeBytecodeCborAuxdata!).length,
    ).to.be.greaterThan(1);
    expect(
      Object.keys(compilation.creationBytecodeCborAuxdata!).length,
    ).to.be.greaterThan(1);
  });

  it('should handle case with no auxdata when metadata is disabled', async () => {
    const contractPath = path.join(__dirname, '..', 'sources', 'Storage');
    const metadata = JSON.parse(
      fs.readFileSync(path.join(contractPath, 'metadata.json'), 'utf8'),
    );
    const sources = {
      'project:/contracts/Storage.sol': {
        content: fs.readFileSync(
          path.join(contractPath, 'sources', 'Storage.sol'),
          'utf8',
        ),
      },
    };

    const solcJsonInput: SolidityJsonInput = {
      language: 'Solidity',
      sources,
      settings: {
        // Disable metadata output
        metadata: {
          appendCBOR: false,
        },
        outputSelection: {
          '*': {
            '*': ['*'],
          },
        },
      },
    };

    const compilation = new SolidityCompilation(
      solc,
      '0.8.19+commit.7dd6d404', // Force compiler version compatible with appendCBOR
      solcJsonInput,
      getCompilationTargetFromMetadata(metadata),
    );

    await compilation.compile();
    const result = await compilation.generateCborAuxdataPositions();

    expect(result).to.be.true;
    expect(compilation.creationBytecodeCborAuxdata).to.deep.equal({});
    expect(compilation.runtimeBytecodeCborAuxdata).to.deep.equal({});
  });

  it('should handle case with single auxdata using Storage contract', async () => {
    const contractPath = path.join(__dirname, '..', 'sources', 'Storage');
    const metadata = JSON.parse(
      fs.readFileSync(path.join(contractPath, 'metadata.json'), 'utf8'),
    );
    const sources = {
      'project:/contracts/Storage.sol': {
        content: fs.readFileSync(
          path.join(contractPath, 'sources', 'Storage.sol'),
          'utf8',
        ),
      },
    };

    const compilation = new SolidityCompilation(
      solc,
      metadata.compiler.version,
      {
        language: 'Solidity',
        sources,
        settings: getSolcSettingsFromMetadata(metadata),
      },
      getCompilationTargetFromMetadata(metadata),
    );

    await compilation.compile();

    const result = await compilation.generateCborAuxdataPositions();

    expect(result).to.be.true;
    expect(compilation.runtimeBytecodeCborAuxdata).to.have.property('1');
    expect(compilation.runtimeBytecodeCborAuxdata!['1']).to.have.property(
      'offset',
    );
    expect(compilation.runtimeBytecodeCborAuxdata!['1']).to.have.property(
      'value',
    );
    expect(compilation.creationBytecodeCborAuxdata).to.have.property('1');
    expect(compilation.creationBytecodeCborAuxdata!['1']).to.have.property(
      'offset',
    );
    expect(compilation.creationBytecodeCborAuxdata!['1']).to.have.property(
      'value',
    );
  });

  it('should throw when compilation target is invalid', async () => {
    const contractPath = path.join(__dirname, '..', 'sources', 'Storage');
    const metadata = JSON.parse(
      fs.readFileSync(path.join(contractPath, 'metadata.json'), 'utf8'),
    );
    const sources = {
      'project:/contracts/Storage.sol': {
        content: fs.readFileSync(
          path.join(contractPath, 'sources', 'Storage.sol'),
          'utf8',
        ),
      },
    };

    const compilation = new SolidityCompilation(
      solc,
      metadata.compiler.version,
      {
        language: 'Solidity',
        sources,
        settings: getSolcSettingsFromMetadata(metadata),
      },
      { name: 'NonExistentContract', path: 'Storage.sol' },
    );

    await expect(compilation.compile()).to.be.eventually.rejectedWith(
      'Contract not found in compiler output',
    );
  });
});
