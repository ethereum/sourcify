import { AuxdataDiff, CompiledContractCborAuxdata } from './CompilationTypes';

function getAuxdataInLegacyAssemblyBranch(
  legacyAssemblyBranch: any,
  auxdatas: string[],
) {
  if (typeof legacyAssemblyBranch === 'object') {
    Object.keys(legacyAssemblyBranch).forEach((key) => {
      switch (key) {
        case '.auxdata': {
          auxdatas.push(legacyAssemblyBranch[key]);
          break;
        }
        case '.code': {
          break;
        }
        default: {
          if (key === '.data' || Number.isInteger(Number(key))) {
            return getAuxdataInLegacyAssemblyBranch(
              legacyAssemblyBranch[key],
              auxdatas,
            );
          }
        }
      }
    });
  }
}

export function findAuxdatasInLegacyAssembly(legacyAssembly: any) {
  const auxdatas: string[] = [];
  getAuxdataInLegacyAssemblyBranch(legacyAssembly, auxdatas);
  return auxdatas;
}

/**
 * Given two bytecodes, this function returns an array of ALL differing indexes.
 * @example getDiffPositions(['A', 'b', 'c', 'A', 'd'], ['A', 'x', 'y', 'A', 'z']) => [1, 2, 4]
 *
 */
function getDiffPositions(original: string, modified: string): number[] {
  const differences: number[] = [];
  const minLength = Math.min(original.length, modified.length);

  for (let i = 0; i < minLength; i++) {
    if (original[i] !== modified[i]) {
      differences.push(i);
    }
  }

  return differences;
}

/**
 *   Checks the raw bytecode indeed includes the auxdata diff at the given position
 */
function bytecodeIncludesAuxdataDiffAt(
  bytecode: string,
  auxdataDiff: AuxdataDiff,
  position: number,
): boolean {
  const { real, diffStart } = auxdataDiff;
  // the difference (i.e metadata hash) starts from "position". To get the whole auxdata instead of metadata go back "diffStart" and until + "real.length" of the auxdata.
  const extracted = bytecode.slice(
    position - diffStart,
    position - diffStart + real.length,
  );
  return extracted === real;
}

function getAuxdatasDiff(originalAuxdatas: string[], editedAuxdatas: string[]) {
  const auxdataDiffs: AuxdataDiff[] = [];
  for (let i = 0; i < originalAuxdatas.length; i++) {
    const diffPositions = getDiffPositions(
      originalAuxdatas[i],
      editedAuxdatas[i],
    );
    auxdataDiffs.push({
      real: originalAuxdatas[i],
      diffStart: diffPositions[0],
      diff: originalAuxdatas[i].substring(
        diffPositions[0],
        diffPositions[diffPositions.length - 1] + 1,
      ),
    });
  }
  return auxdataDiffs;
}

/**
 * Finds the positions of the auxdata in the bytecode.
 * The compiler outputs the auxdata values in the `legacyAssembly` field. However we can't use these values to do a simple string search on the compiled bytecode because an attacker can embed these values in the compiled contract code and cause the correspoding field in the onchain bytecode to be ignored falsely during verification.
 * A way to find the *metadata hashes* in the bytecode is to recompile the contract with a slightly edited source code and compare the differences in the raw bytecodes. However, this will only give us the positions of the metadata hashes in the bytecode. We need to find the positions of the whole *auxdata* in the bytecode.
 * So we go through each of the differences in the raw bytecode and check if an auxdata diff value from the legacyAssembly is included in that difference. If it is, we have found the position of the auxdata in the bytecode.
 */
export function findAuxdataPositions(
  originalBytecode: string,
  editedBytecode: string,
  originalAuxdatas: string[],
  editedAuxdatas: string[],
): CompiledContractCborAuxdata {
  const auxdataDiffObjects = getAuxdatasDiff(originalAuxdatas, editedAuxdatas);

  const diffPositionsBytecodes = getDiffPositions(
    originalBytecode,
    editedBytecode,
  );
  const auxdataPositions: CompiledContractCborAuxdata = {};

  let prevDiffPosition = -99;
  for (const diffPosition of diffPositionsBytecodes) {
    // Don't check consecutive diffs like 55, 56, 57... , only if there's a gap like 55, 57, 58, then 78, 79, 80...
    if (prevDiffPosition + 1 === diffPosition) {
      prevDiffPosition = diffPosition;
      continue;
    }
    // New diff position
    for (const auxdataDiffIndex in auxdataDiffObjects) {
      const auxdataPositionsIndex = parseInt(auxdataDiffIndex) + 1;
      if (
        auxdataPositions[auxdataPositionsIndex] === undefined &&
        bytecodeIncludesAuxdataDiffAt(
          originalBytecode,
          auxdataDiffObjects[auxdataDiffIndex],
          diffPosition,
        )
      ) {
        auxdataPositions[auxdataPositionsIndex] = {
          offset:
            (diffPosition -
              auxdataDiffObjects[auxdataDiffIndex].diffStart -
              2) /
            2,
          value: `0x${auxdataDiffObjects[auxdataDiffIndex].real}`,
        };
      }
    }
    prevDiffPosition = diffPosition;
  }

  return auxdataPositions;
}
