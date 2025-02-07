declare let describe: unknown | any;
declare let it: unknown | any;

import { expect } from 'chai';
import {
  SolidityCheckedContract,
  getGithubUrl,
  getIpfsGateway,
  performFetch,
} from '../src/lib/SolidityCheckedContract';
import storageMetadata from './sources/Storage/metadata.json';
import { Metadata, MissingSources } from '../src/lib/types';
import WrongMetadata from './sources/WrongMetadata/metadata.json';
import SimplyLog from './sources/WrongMetadata/SimplyLog.json';
import { id } from 'ethers';
import { solc, vyperCompiler } from './utils';
import { fetchWithBackoff } from '../src/lib/utils';
import nock from 'nock';
import path from 'path';
import fs from 'fs';
import { VyperCheckedContract, VyperJsonInput, VyperSettings } from '../src';
import Sinon from 'sinon';

describe('Checked contract', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should return null after failed performFetch', async () => {
    expect(await performFetch('httpx://')).to.equal(null);
  });
  it('Should call fetchWithBackoff with headers', async () => {
    const ipfsGateway = 'http://ipfs-gateway';
    nock(ipfsGateway, {
      reqheaders: {
        test: 'test',
      },
    })
      .get('/')
      .reply(function () {
        return [200];
      });
    const response = await fetchWithBackoff(ipfsGateway, {
      test: 'test',
    });
    expect(response.status).to.equal(200);
  });
  it('Should fail getIpfsGateway with unparsable headers', async () => {
    process.env.IPFS_GATEWAY_HEADERS = `{ "test": unparsable-value }`;
    try {
      getIpfsGateway();
    } catch (error: any) {
      expect(error.message).to.equal(
        'Error while parsing IPFS_GATEWAY_HEADERS option',
      );
    }
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
        ipfsGateway.url + 'QmTkSBN1QffhGKwx365m5va6Pikz3pUJcAfaSRybkeCCDr',
        '0x00',
      ),
    ).equals(null);
  });
  it('Should performFetch', async () => {
    const ipfsGateway = getIpfsGateway();
    expect(
      await performFetch(
        ipfsGateway.url + 'QmTkSBN1QffhGKwx365m5va6Pikz3pUJcAfaSRybkeCCDr',
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
    const contract = new SolidityCheckedContract(
      solc,
      storageMetadata as any as Metadata,
      {},
      missingSources,
      {},
    );
    await SolidityCheckedContract.fetchMissing(contract);
    const sources = Object.keys(contract.sources);
    expect(sources).lengthOf(1);
    expect(sources[0]).equals('Storage.sol');
  });
  it('Should tryToFindPerfectMetadata from checked contract', async () => {
    const contract = new SolidityCheckedContract(
      solc,
      WrongMetadata as Metadata,
      {
        'SimplyLog.sol': SimplyLog.source,
      },
    );

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
  it('Should mock a metadata object for a Vyper contract', async () => {
    const contractFolderPath = path.join(
      __dirname,
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractFileName = 'test.vy';
    const contractName = 'test';
    const vyperContent = await fs.promises.readFile(
      path.join(contractFolderPath, contractFileName),
    );
    const vyperVersion = '0.3.10+commit.91361694';
    const vyperSettings = {
      evmVersion: 'istanbul',
      outputSelection: {
        '*': ['evm.bytecode'],
      },
    } as VyperSettings;

    const checkedContract = new VyperCheckedContract(
      vyperCompiler,
      vyperVersion,
      contractFileName,
      contractName,
      vyperSettings,
      {
        [contractFileName]: vyperContent.toString(),
      },
    );

    expect(checkedContract.metadata).to.deep.equal({
      compiler: { version: vyperVersion },
      language: 'Vyper',
      output: {
        abi: [],
        devdoc: { kind: 'dev', methods: {} },
        userdoc: { kind: 'user', methods: {} },
      },
      settings: {
        ...vyperSettings,
        compilationTarget: { [contractFileName]: contractName },
      },
      sources: {
        [contractFileName]: {
          keccak256: id(vyperContent.toString()),
        },
      },
      version: 1,
    });
  });

  it('Should throw an error on recompilation for a wrong name of a Vyper contract', async () => {
    const contractFolderPath = path.join(
      __dirname,
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractFileName = 'test.vy';
    const wrongContractName = 'tes';
    const vyperContent = await fs.promises.readFile(
      path.join(contractFolderPath, contractFileName),
    );
    const vyperVersion = '0.3.10+commit.91361694';
    const vyperSettings = {
      evmVersion: 'istanbul',
      outputSelection: {
        '*': ['evm.bytecode'],
      },
    } as VyperSettings;

    const checkedContract = new VyperCheckedContract(
      vyperCompiler,
      vyperVersion,
      contractFileName,
      wrongContractName,
      vyperSettings,
      {
        [contractFileName]: vyperContent.toString(),
      },
    );

    try {
      await checkedContract.recompile();
      expect.fail('Should have thrown an error');
    } catch (e: any) {
      expect(e.message).to.equal('Compiler error');
    }
  });

  it('Should provide a correct VyperJsonInput to the vyper compiler', async () => {
    const compileSpy = sandbox.spy(vyperCompiler, 'compile');

    const contractFolderPath = path.join(
      __dirname,
      'sources',
      'Vyper',
      'testcontract',
    );
    const contractFileName = 'test.vy';
    const contractName = 'test';
    const vyperContent = await fs.promises.readFile(
      path.join(contractFolderPath, contractFileName),
    );
    const vyperVersion = '0.3.10+commit.91361694';
    const vyperSettings = {
      evmVersion: 'istanbul',
      outputSelection: {
        '*': ['evm.bytecode'],
      },
    } as VyperSettings;

    const checkedContract = new VyperCheckedContract(
      vyperCompiler,
      vyperVersion,
      contractFileName,
      contractName,
      vyperSettings,
      {
        [contractFileName]: vyperContent.toString(),
      },
    );

    await checkedContract.recompile();

    const expectedVyperJsonInput = {
      language: 'Vyper',
      sources: { [contractFileName]: { content: vyperContent.toString() } },
      settings: vyperSettings,
    } as VyperJsonInput;
    expect(compileSpy.calledWith(vyperVersion, expectedVyperJsonInput)).to.be
      .true;
  });
});
