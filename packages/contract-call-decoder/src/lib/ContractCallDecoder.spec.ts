import { Provider } from '@ethersproject/providers';
import test from 'ava';
import provider from 'eth-provider';

import {
  decodeContractCall,
  evaluate,
  findSelectorAndAbiItemFromSignatureHash,
  getMetadataFromAddress,
  MetadataSources,
} from './ContractCallDecoder';

test('can evaluate call data', async (t) => {
  const ethereumProvider = provider('https://rpc.ankr.com/eth_goerli');
  t.is(
    await evaluate(
      'Set the tree age to `numYears` years',
      [
        {
          constant: false,
          inputs: [{ name: 'numYears', type: 'uint256' }],
          name: 'setAge',
          outputs: [],
          payable: false,
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      {
        to: '0x8521742d3f456bd237e312d6e30724960f72517a',
        data: '0xd5dcf127000000000000000000000000000000000000000000000000000000000000000a',
      },
      ethereumProvider as unknown as Provider,
    ),
    'Set the tree age to 10 years',
  );
});

test.skip('get metadata of a non-contract address', async (t) => {
  const ethereumProvider = provider('https://ethereum-holesky.publicnode.com');
  try {
    await getMetadataFromAddress({
      address: '0x7dBA08Bdc233B28e2c99723c402Fc8F4e35AB53B',
      chainId: 17000,
      source: MetadataSources.BytecodeMetadata,
      rpcProvider: ethereumProvider,
    });
  } catch (e) {
    t.is(
      (e as { message: string }).message,
      `Bytecode not found while using "MetadataSources.BytecodeMetadata"`,
    );
  }
});

test('can extract metadata from address', async (t) => {
  t.is(
    (
      await getMetadataFromAddress({
        address: '0xb1FC6119024ca02EEBe30BD31a5D5368c05886Ac',
        chainId: 11155111,
      })
    ).language,
    'Solidity',
  );
});

test('find by signature', async (t) => {
  const tx = {
    to: '0x8521742d3f456bd237e312d6e30724960f72517a',
    input:
      '0xd5dcf127000000000000000000000000000000000000000000000000000000000000000a',
  };
  const functionSignatureHash = tx.input.slice(0, 10);

  const selectorAndAbi = findSelectorAndAbiItemFromSignatureHash(
    functionSignatureHash,
    [
      {
        constant: false,
        inputs: [{ name: 'numYears', type: 'uint256' }],
        name: 'setAge',
        outputs: [],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
  );

  if (!selectorAndAbi) {
    return;
  }

  t.is(selectorAndAbi.abi.name, 'setAge');
});

test('evaluate calldata from tx getting metadata from sourcify', async (t) => {
  const tx = {
    to: '0x7Ad2e9521117D9C5fc47BE79aadA165D683B08ef',
    data: '0xf5a6259f000000000000000000000000000000000000000000000000000000000000000c',
  };
  const decodedContractCall = await decodeContractCall(tx, {
    chainId: 11155111,
  });
  if (!decodedContractCall) {
    return;
  }
  t.is(decodedContractCall.method.notice, 'This function will add 1 to 12');
});

test('evaluate calldata can correctly parse addresses, bigints and bytes', async (t) => {
  const tx = {
    to: '0x2f55daC1C137F3eE8c8513858f161671dDddf214',
    data: '0xb88d4fde0000000000000000000000007dba08bdc233b28e2c99723c402fc8f4e35ab55b0000000000000000000000007dba08bdc233b28e2c99723c402fc8f4e35ab55b000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000004010101ff00000000000000000000000000000000000000000000000000000000',
  };
  const decodedContractCall = await decodeContractCall(tx, { chainId: 1 });
  if (!decodedContractCall) {
    return;
  }
  t.is(
    decodedContractCall.method.decodedParams[0],
    '0x7dBA08Bdc233B28e2c99723c402Fc8F4e35AB55B',
  );
  t.is(`${decodedContractCall.method.decodedParams[2]}`, '1');
  t.is(`${decodedContractCall.method.decodedParams[3]}`, '0x010101ff');
});

test.skip('evaluate calldata from tx getting metadata from bytecode', async (t) => {
  const ethereumProvider = provider('https://ethereum-holesky.publicnode.com');
  const tx = {
    to: '0x8b3436ba4c7638799ECce03d1a6500A03d71c7C1',
    data: '0xcea299370000000000000000000000000000000000000000000000000000000000000002',
  };
  const decodedContractCall = await decodeContractCall(tx, {
    source: MetadataSources.BytecodeMetadata,
    rpcProvider: ethereumProvider,
  });
  if (!decodedContractCall) {
    return;
  }
  t.is(decodedContractCall.method.notice, 'Set the new vale 4');
});
