// Types used internally by the server.

/**
 * A type for specfifying the strictness level of querying (only full or any kind of matches)
 */
export type MatchLevel = "full_match" | "any_match";

/**
 * An array wrapper with info properties.
 */
export type FilesInfo<T> = { status: MatchQuality; files: T };

/**
 * A type for specifying the match quality of files.
 */
export type MatchQuality = "full" | "partial";

export declare interface ContractData {
  full: string[];
  partial: string[];
}

export declare interface PaginatedContractData {
  results: string[];
  pagination: {
    currentPage: number;
    totalPages: number;
    resultsCurrentPage: number;
    resultsPerPage: number;
    totalResults: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export type RepositoryTag = {
  timestamp: any;
};

export type PathConfig = {
  matchQuality: MatchQuality;
  chainId: string;
  address: string;
  fileName?: string;
  source?: boolean;
};

export type FilesRaw = {
  [path: string]: string;
};

export type FileObject = {
  name: string;
  path: string;
  content?: string;
};
