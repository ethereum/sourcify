import { REPOSITORY_SERVER_URL } from "../constants";

export const generateRepoLink = (
  chainId: string | number,
  address: string,
  matchStatus: "perfect" | "partial"
) => {
  let matchPath;
  if (matchStatus === "perfect") matchPath = "full_match";
  if (matchStatus === "partial") matchPath = "partial_match";
  return `${REPOSITORY_SERVER_URL}/contracts/${matchPath}/${chainId}/${address}`;
};
