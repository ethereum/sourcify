import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { SourcifyChain, TraceSupportedRPC } from '../src';
import { JsonRpcProvider } from 'ethers';

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('SourcifyChain', () => {
  let sourcifyChain: SourcifyChain;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sourcifyChain = new SourcifyChain({
      name: 'TestChain',
      chainId: 1,
      rpc: ['http://localhost:8545'],
      supported: true,
      traceSupportedRPCs: [{ index: 0, type: 'trace_transaction' }],
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getCreationBytecodeForFactory', () => {
    it('should throw an error if trace support is not available', async () => {
      sourcifyChain = new SourcifyChain({
        name: 'TestChain',
        chainId: 1,
        rpc: ['http://localhost:8545'],
        supported: true,
      });
      await expect(
        sourcifyChain.getCreationBytecodeForFactory('0xhash', '0xaddress'),
      ).to.be.rejectedWith(
        'No trace support for chain 1. No other method to get the creation bytecode',
      );
    });

    it('should extract creation bytecode from parity traces', async () => {
      const mockProvider = sourcifyChain.providers[0] as JsonRpcProvider;
      sandbox.stub(mockProvider, 'send').resolves([
        {
          type: 'create',
          result: { address: '0xaddress' },
          action: { init: '0xcreationBytecode' },
        },
      ]);

      const result = await sourcifyChain.getCreationBytecodeForFactory(
        '0xhash',
        '0xaddress',
      );
      expect(result).to.equal('0xcreationBytecode');
      expect(mockProvider.send).to.have.been.calledWith('trace_transaction', [
        '0xhash',
      ]);
    });

    it('should throw an error if no create trace is found', async () => {
      const mockProvider = sourcifyChain.providers[0] as JsonRpcProvider;
      sandbox
        .stub(mockProvider, 'send')
        .resolves([{ type: 'call' }, { type: 'suicide' }]);

      await expect(
        sourcifyChain.getCreationBytecodeForFactory('0xhash', '0xaddress'),
      ).to.be.rejectedWith('Couldnt get the creation bytecode for factory');
    });

    it('should try multiple trace-supported RPCs if the first one fails', async () => {
      sourcifyChain.traceSupportedRPCs = [
        { index: 0, type: 'trace_transaction' },
        { index: 1, type: 'trace_transaction' },
      ] as TraceSupportedRPC[];
      sourcifyChain.providers.push(
        new JsonRpcProvider('http://localhost:8546'),
      );

      const mockProvider1 = sourcifyChain.providers[0] as JsonRpcProvider;
      const mockProvider2 = sourcifyChain.providers[1] as JsonRpcProvider;

      sandbox.stub(mockProvider1, 'send').rejects(new Error('RPC error'));
      sandbox.stub(mockProvider2, 'send').resolves([
        {
          type: 'create',
          result: { address: '0xaddress' },
          action: { init: '0xcreationBytecode' },
        },
      ]);

      const result = await sourcifyChain.getCreationBytecodeForFactory(
        '0xhash',
        '0xaddress',
      );
      expect(result).to.equal('0xcreationBytecode');
      expect(mockProvider1.send).to.have.been.called;
      expect(mockProvider2.send).to.have.been.called;
    });
  });

  describe('extractFromParityTraceProvider', () => {
    it('should throw an error if the contract address does not match', async () => {
      const mockProvider = sourcifyChain.providers[0] as JsonRpcProvider;
      sandbox.stub(mockProvider, 'send').resolves([
        {
          type: 'create',
          result: { address: '0xdifferentAddress' },
          action: { init: '0xcreationBytecode' },
        },
      ]);

      await expect(
        sourcifyChain.extractFromParityTraceProvider(
          '0xhash',
          '0xaddress',
          mockProvider,
        ),
      ).to.be.rejectedWith(
        `Provided tx 0xhash does not create the expected contract 0xaddress. Created contracts by this tx: 0xdifferentAddress`,
      );
    });

    it('should throw an error when .action.init is not found', async () => {
      const mockProvider = sourcifyChain.providers[0] as JsonRpcProvider;
      sandbox.stub(mockProvider, 'send').resolves([
        {
          type: 'create',
          result: { address: '0xaddress' },
          action: {}, // Missing 'init' property
        },
      ]);

      await expect(
        sourcifyChain.extractFromParityTraceProvider(
          '0xhash',
          '0xaddress',
          mockProvider,
        ),
      ).to.be.rejectedWith('.action.init not found');
    });

    // Add more tests for extractFromParityTraceProvider here if needed
  });
});
