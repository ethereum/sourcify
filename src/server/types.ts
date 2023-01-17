// Types used internally by the server.

/**
 * A type for specfifying the strictness level of querying (only full or any kind of matches)
 */
export type MatchLevel = "full_match" | "any_match";

/**
 * An array wrapper with info properties.
 */
export type FilesInfo<T> = { status: MatchQuality; files: Array<T> };

/**
 * A type for specifying the match quality of files.
 */
export type MatchQuality = "full" | "partial";

export declare interface ContractData {
  full: string[];
  partial: string[];
}

export type RepositoryTag = {
  timestamp: any;
  repositoryVersion: string;
};
