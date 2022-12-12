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
      ethereumProvider as unknown as Provider
    ),
    'Set the tree age to 10 years'
  );
});

test('get metadata of a non-contract address', async (t) => {
  const ethereumProvider = provider('https://rpc.ankr.com/eth_goerli');
  try {
    await getMetadataFromAddress({
      address: '0x7dBA08Bdc233B28e2c99723c402Fc8F4e35AB53B',
      chainId: 5,
      source: MetadataSources.BytecodeMetadata,
      rpcProvider: ethereumProvider,
    });
  } catch (e) {
    t.is(
      (e as { message: string }).message,
      `Bytecode not found while using "MetadataSources.BytecodeMetadata"`
    );
  }
});

test('can extract metadata from address', async (t) => {
  t.is(
    (
      await getMetadataFromAddress({
        address: '0xD4B081C226Bc8aBdaf111DEf54c09E779ad29428',
        chainId: 5,
      })
    ).language,
    'Solidity'
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
    ]
  );

  if (!selectorAndAbi) {
    return;
  }

  t.is(selectorAndAbi.abi.name, 'setAge');
});

test('evaluate calldata from tx getting metadata from sourcify', async (t) => {
  const tx = {
    to: '0x05c99480624597944e50515a86d1Ec1aD63f23e6',
    data: '0x1cf9504d00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000046369616f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000046369616f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000046369616f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000046369616f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000046369616f00000000000000000000000000000000000000000000000000000000',
  };
  const decodedContractCall = await decodeContractCall(tx, { chainId: 5 });
  if (!decodedContractCall) {
    return;
  }
  t.is(decodedContractCall.method.notice, 'return 1 multiplied by 4: 4');
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
    '0x7dBA08Bdc233B28e2c99723c402Fc8F4e35AB55B'
  );
  t.is(`${decodedContractCall.method.decodedParams[2]}`, '1');
  t.is(`${decodedContractCall.method.decodedParams[3]}`, '0x010101ff');
});

test('evaluate calldata from tx getting metadata from bytecode', async (t) => {
  const ethereumProvider = provider('https://rpc.ankr.com/eth_goerli');
  const tx = {
    to: '0xD4B081C226Bc8aBdaf111DEf54c09E779ad29428',
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
