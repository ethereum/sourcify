import { Result } from '@ethersproject/abi';
import { BigNumber } from 'ethers';

function arrayContainsMixedTypeKeys(array: Result): boolean {
  // eslint-disable-next-line functional/no-let
  let realLength = 0;
  // eslint-disable-next-line functional/no-loop-statement,@typescript-eslint/no-unused-vars
  for (const _ in array) {
    realLength++;
  }
  return array.length !== realLength;
}

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

type LocalResult = {
  readonly [index: string]: unknown;
};

export function getValueFromDecodedFunctionData(
  decodedFunctionData: Result
): unknown {
  if (
    Array.isArray(decodedFunctionData) &&
    arrayContainsMixedTypeKeys(decodedFunctionData)
  ) {
    const decodedFunctionDataWithoutStringKeys: Mutable<Result> = [];
    // eslint-disable-next-line functional/no-loop-statement
    for (const prop in decodedFunctionData) {
      if (!(parseInt(prop) >= 0)) {
        // eslint-disable-next-line functional/immutable-data
        decodedFunctionDataWithoutStringKeys[prop] = decodedFunctionData[prop];
      }
    }

    const result = Object.assign({}, decodedFunctionDataWithoutStringKeys);
    const res: Mutable<LocalResult> = {};
    // eslint-disable-next-line functional/no-loop-statement
    for (const property in result) {
      // eslint-disable-next-line functional/immutable-data
      res[property] = getValueFromDecodedFunctionData(result[property]);
    }
    return res;
  } else if (Array.isArray(decodedFunctionData)) {
    return decodedFunctionData.map((value) =>
      getValueFromDecodedFunctionData(value)
    );
  } else if (decodedFunctionData instanceof BigNumber) {
    try {
      return decodedFunctionData.toBigInt();
    } catch (e: unknown) {
      return decodedFunctionData.toNumber();
    }
  } else {
    return decodedFunctionData;
  }
}

export function extractCustomFields(doc: Result) {
  return Object.keys(doc)
    .filter((key) => key.startsWith('custom:'))
    .reduce((previous, current) => {
      const newValue: Mutable<LocalResult> = {};
      // eslint-disable-next-line functional/immutable-data
      newValue[current.replace('custom:', '')] = doc[current];
      return { ...previous, ...newValue };
    }, {});
}
