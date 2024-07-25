import Path from "path";
import fs from "fs";
import { MatchLevelWithoutAny, MatchQuality } from "../../types";
import { getAddress } from "ethers";

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
