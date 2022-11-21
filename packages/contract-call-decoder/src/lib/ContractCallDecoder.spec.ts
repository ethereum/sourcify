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
      }
    ),
    'Set the tree age to 10 years'
  );
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

  t.is(
    findSelectorAndAbiItemFromSignatureHash(functionSignatureHash, [
      {
        constant: false,
        inputs: [{ name: 'numYears', type: 'uint256' }],
        name: 'setAge',
        outputs: [],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ]).abi.name,
    'setAge'
  );
});

test('evaluate calldata from tx getting metadata from sourcify', async (t) => {
  const tx = {
    to: '0xD4B081C226Bc8aBdaf111DEf54c09E779ad29428',
    data: '0xcea299370000000000000000000000000000000000000000000000000000000000000002',
  };
  t.is(await decodeContractCall(tx, { chainId: 5 }), 'Set the new vale 4');
});

test('evaluate calldata from tx getting metadata from bytecode', async (t) => {
  const ethereumProvider = provider('https://rpc.ankr.com/eth_goerli');
  const tx = {
    to: '0xD4B081C226Bc8aBdaf111DEf54c09E779ad29428',
    data: '0xcea299370000000000000000000000000000000000000000000000000000000000000002',
  };
  t.is(
    await decodeContractCall(tx, {
      source: MetadataSources.BytecodeMetadata,
      rpcProvider: ethereumProvider,
      chainId: 5,
    }),
    'Set the new vale 4'
  );
});
