import { Result } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';

/**
 * Check if the array contains both string and number as keys
 * @param array any array
 * @returns true if the array contains both string and number as keys
 */
function arrayContainsMixedTypeKeys(array: Result): boolean {
  let realLength = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

/**
 *
 * @param decodedFunctionData response from ethers Interface.decodeFunctionData (mixed typed index array)
 * @returns a javascript rappresentation of the arrays / objects / values passed in the calldata
 */
export function getValueFromDecodedFunctionData(
  decodedFunctionData: Result
): unknown {
  if (
    Array.isArray(decodedFunctionData) &&
    arrayContainsMixedTypeKeys(decodedFunctionData)
  ) {
    const decodedFunctionDataWithoutStringKeys: Mutable<Result> = [];
    for (const prop in decodedFunctionData) {
      if (!(parseInt(prop) >= 0)) {
        decodedFunctionDataWithoutStringKeys[prop] = decodedFunctionData[prop];
      }
    }

    const result = Object.assign({}, decodedFunctionDataWithoutStringKeys);
    const res: Mutable<LocalResult> = {};
    for (const property in result) {
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
      newValue[current.replace('custom:', '')] = doc[current];
      return { ...previous, ...newValue };
    }, {});
}
