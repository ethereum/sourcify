import {
  InvalidSources,
  Language,
  Match,
  Metadata,
  MissingSources,
  PathContent,
  Status,
  StringMap,
} from "@ethereum-sourcify/lib-sourcify";

export interface PathContentMap {
  [id: string]: PathContent;
}

export type ContractMeta = {
  compiledPath?: string;
  name?: string;
  address?: string;
  chainId?: string;
  creatorTxHash?: string;
  status?: Status;
  statusMessage?: string;
  storageTimestamp?: Date;
};

export type ContractWrapper = ContractMeta & {
  contract: {
    language: Language;
    metadata: Metadata;
    sources: StringMap;
    missing: MissingSources;
    invalid: InvalidSources;
    creationBytecode?: string;
    compiledPath?: string;
    name?: string;
  };
};

export interface ContractWrapperMap {
  [id: string]: ContractWrapper;
}

declare module "express-session" {
  interface Session {
    inputFiles: PathContentMap;
    contractWrappers: ContractWrapperMap;
    unusedSources: string[];
  }
}

export interface ResponseMatch
  extends Omit<Match, "runtimeMatch" | "creationMatch"> {
  status: Status;
}

export function getMatchStatus(match: Match): Status {
  if (match.runtimeMatch === "perfect" || match.creationMatch === "perfect") {
    return "perfect";
  }
  if (match.runtimeMatch === "partial" || match.creationMatch === "partial") {
    return "partial";
  }
  if (match.runtimeMatch === "extra-file-input-bug") {
    return "extra-file-input-bug";
  }
  return null;
}

export function getResponseMatchFromMatch(match: Match): ResponseMatch {
  const status = getMatchStatus(match);
  const responseMatch = {
    ...match,
    status,
    runtimeMatch: undefined,
    creationMatch: undefined,
  };

  return responseMatch;
}
