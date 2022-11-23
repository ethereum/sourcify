import { BigNumber } from 'ethers';

function arrayContainsMixedTypeKeys(array): boolean {
  // eslint-disable-next-line functional/no-let
  let realLength = 0;
  // eslint-disable-next-line functional/no-loop-statement
  for (const _ in array) {
    realLength++;
  }
  return array.length !== realLength;
}

export function getValueFromDecodedFunctionData(decodedFunctionData: any) {
  if (
    Array.isArray(decodedFunctionData) &&
    arrayContainsMixedTypeKeys(decodedFunctionData)
  ) {
    const decodedFunctionDataWithoutStringKeys = [];
    // eslint-disable-next-line functional/no-loop-statement
    for (const prop in decodedFunctionData) {
      if (!(parseInt(prop) >= 0)) {
        // eslint-disable-next-line functional/immutable-data
        decodedFunctionDataWithoutStringKeys[prop] = decodedFunctionData[prop];
      }
    }

    const result = Object.assign({}, decodedFunctionDataWithoutStringKeys);
    const res = {};
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
