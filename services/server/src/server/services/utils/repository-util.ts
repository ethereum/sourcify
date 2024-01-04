/**
 * A type for specifying the match quality of files.
 */
export type MatchQuality = "full" | "partial";

export type PathConfig = {
  matchQuality: MatchQuality;
  chainId: string;
  address: string;
  fileName?: string;
  source?: boolean;
};
