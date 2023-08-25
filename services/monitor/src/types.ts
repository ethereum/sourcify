import SourceFetcher from "./source-fetcher";

export type KnownSourceFetchers = {
  ipfs: SourceFetcher;
  swarm?: SourceFetcher;
};
