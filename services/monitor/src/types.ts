import DecentralizedStorageFetcher from "./DecentralizedStorageFetcher";

export type KnownDecentralizedStorageFetchers = {
  [type in DecentralizedStorageOrigin]?: DecentralizedStorageFetcher;
};

export type DecentralizedStorageOrigin = "ipfs" | "bzzr1" | "bzzr0";
