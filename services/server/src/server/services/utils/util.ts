import Path from "path";
import fs from "fs";
import { MatchQuality } from "../../types";

export const getFileRelativePath = (
  chainId: string,
  address: string,
  contractStatus: MatchQuality,
  file: string,
  { isSource } = { isSource: false }
): string => {
  const baseDir = Path.join(
    "contracts",
    contractStatus === "full" ? "full_match" : "partial_match",
    chainId,
    address
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
