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
 * Maps every legacy-assembly auxdata block to its `{ offset, value }`
 * inside the recompiled bytecode.
 *
 * @param originalBytecode – bytecode produced from the **original** sources
 * @param editedBytecode   – bytecode produced from the *slightly different* sources
 * @param originalAuxdatas – auxdata strings coming from the original compile
 * @param editedAuxdatas   – auxdata strings coming from the edited compile
 *
 * @returns an object whose keys are the indexes of the auxdata items
 *          (as they appear in `legacyAssembly`) and whose values are
 *          their position and value in the originalBytecode.
 */
export function findAuxdataPositions(
  originalBytecode: string,
  editedBytecode: string,
  originalAuxdatas: string[],
  editedAuxdatas: string[],
): CompiledContractCborAuxdata {
  // 1. Build auxdataDiffs that explain how each auxdata is changing after recompilation with slightly different sources

  // A single AuxdataDiff has 3 keys: real, diffStart (int offset of diff), diff
  // original: a2646970667358221220123af2412fd4b1b89740f76c6ab76a6412bbde98fab732fb97eb012abe7123ff64736f6c63430007000033
  //           └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  //               REAL
  // edited:   a2646970667358221220dceca8706b29e917dacf25fceef95acac8d90d765ac926663ce4096195952b6164736f6c63430007000033
  //           └──────────────────┘└──────────────────────────────────────────────────────────────┘
  //               DIFFSTART           DIFF
  const auxdataDiffs = getAuxdatasDiff(originalAuxdatas, editedAuxdatas);

  // 2. All bytecode character positions that differ after recompilation with slightly different sources
  const bytecodeDiffPositions = getDiffPositions(
    originalBytecode,
    editedBytecode,
  );

  // 3.  For every bytecodeDiffPosition, see if it hosts an auxdataDiff
  const result: CompiledContractCborAuxdata = {};
  let prevPos = -Infinity;
  for (const pos of bytecodeDiffPositions) {
    // Skip positions that are immediately consecutive to the previous one,
    // two auxdataDiffs can't be adjacent to each other
    if (pos === prevPos + 1) {
      prevPos = pos;
      continue;
    }

    // For each bytecodeDiffPosition, test every auxdataDiff that we haven't already mapped
    for (let idx = 0; idx < auxdataDiffs.length; idx++) {
      // The first CompiledContractCborAuxdata element key is '1'
      const resultIndex = idx + 1;

      // If we already mapped this auxdata, skip
      if (result[resultIndex] !== undefined) continue;

      const diff = auxdataDiffs[idx];
      // If in position `pos` of the originalBytecode we find the `auxdataDiff.real` value
      if (bytecodeIncludesAuxdataDiffAt(originalBytecode, diff, pos)) {
        // Store the CompiledContractCborAuxdata element
        result[resultIndex] = {
          offset: (pos - diff.diffStart - 2) / 2,
          value: `0x${diff.real}`,
        };
        // One auxdata for each bytecodeDiffPosition. See https://github.com/ethereum/sourcify/issues/1980
        break;
      }
    }

    prevPos = pos;
  }

  return result;
}
