import Path from "path";
import fs from "fs";
import { MatchLevelWithoutAny, MatchQuality, V2MatchLevel } from "../../types";
import { getAddress } from "ethers";
import { Match, Status } from "@ethereum-sourcify/lib-sourcify";

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

/**
 * Verify that either the newMatch runtime or creation match is better
 * ensuring that neither the newMatch runtime nor creation is worse
 * than the existing match
 */
export function isBetterMatch(newMatch: Match, existingMatch: Match): boolean {
  if (
    /** if newMatch.creationMatch is better */
    getStatusDiff(newMatch.creationMatch, existingMatch.creationMatch) > 0 &&
    /** and newMatch.runtimeMatch is not worse */
    getStatusDiff(newMatch.runtimeMatch, existingMatch.runtimeMatch) >= 0
  ) {
    return true;
  }
  if (
    /** if newMatch.runtimeMatch is better */
    getStatusDiff(newMatch.runtimeMatch, existingMatch.runtimeMatch) > 0 &&
    /** and newMatch.creationMatch is not worse */
    getStatusDiff(newMatch.creationMatch, existingMatch.creationMatch) >= 0
  ) {
    return true;
  }
  return false;
}

export function toV2MatchLevel(status: Status): V2MatchLevel {
  switch (status) {
    case "perfect":
      return "exact_match";
    case "partial":
      return "match";
    default:
      return null;
  }
}
