import Path from "path";
import fs from "fs";
import { MatchLevelWithoutAny, MatchQuality } from "../../types";
import { getAddress } from "ethers";
import { Status } from "@ethereum-sourcify/lib-sourcify";

export const getFileRelativePath = (
  chainId: string,
  address: string,
  contractStatus: MatchQuality,
  file: string,
  { isSource } = { isSource: false },
): string => {
  const baseDir = Path.join(
    "contracts",
    contractStatus === "full" ? "full_match" : "partial_match",
    chainId,
    address,
  );

  return isSource
    ? Path.join(baseDir, "sources", file)
    : Path.join(baseDir, file);
};

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch (e) {
    return false;
  }
}

export async function readFile(
  repositoryPath: string,
  matchType: MatchLevelWithoutAny,
  chainId: string,
  address: string,
  path: string,
): Promise<string | false> {
  const fullPath = Path.join(
    repositoryPath,
    "contracts",
    matchType as string,
    chainId,
    getAddress(address),
    path,
  );
  try {
    const loadedFile = await fs.promises.readFile(fullPath);
    return loadedFile.toString() || false;
  } catch (error) {
    return false;
  }
}

/**
 * This function returns a positive number if the first Status
 * is better than the second one; 0 if they are the same; or a
 * negative number if the first Status is worse than the second one
 */
export function getStatusDiff(status1: Status, status2: Status): number {
  const scores = {
    error: 0,
    "extra-file-input-bug": 0,
    partial: 1,
    perfect: 2,
  };
  const status1Value = status1 != null ? scores[status1] : 0;
  const status2Value = status2 != null ? scores[status2] : 0;
  return status1Value - status2Value;
}
