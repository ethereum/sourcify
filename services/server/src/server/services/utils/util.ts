import Path from "path";
import { MatchQuality } from "../../types";

export const getFileRelativePath = (
  chainId: string,
  address: string,
  contractStatus: MatchQuality,
  file: string
): string => {
  return Path.join(
    "contracts",
    contractStatus === "full" ? "full_match" : "partial_match",
    chainId,
    address,
    "sources",
    file
  );
};
