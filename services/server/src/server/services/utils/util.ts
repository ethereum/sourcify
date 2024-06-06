import Path from "path";
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
