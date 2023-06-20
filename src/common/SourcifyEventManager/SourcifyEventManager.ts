import { Match } from "@ethereum-sourcify/lib-sourcify";
import { EventManager, GenericEvents } from "../EventManager";

interface Events extends GenericEvents {
  "*": (event: string, argument: any) => void;
  "Verification.MatchStored": (match: Match) => void;
  "Monitor.Error.CantStart": (e: { chainId: string; message: string }) => void;
  "Monitor.Started": (obj: {
    chainId: string;
    web3url: string;
    lastBlockNumber: number;
    startBlock: number;
  }) => void;
  "Monitor.Stopped": (chainId: string) => void;
  "Monitor.ProcessingBlock": (obj: {
    blockNumber: number;
    chainId: string;
    getBlockPause: number;
  }) => void;
  "Monitor.AlreadyVerified": (obj: {
    address: string;
    chainId: string;
  }) => void;
  "Monitor.NewContract": (obj: { address: string; chainId: string }) => void;
  "Monitor.Error": (obj: { message: string; stack?: string }) => void;
  "SourceFetcher.UsingFallback": (obj: {
    fetchUrl: string;
    fallbackUrl: string;
  }) => void;
  "SourceFetcher.NewSubscription": (obj: {
    fetchUrl: string;
    sourceHash: string;
    filesPending: number;
    subscriptions: number;
  }) => void;
  "SourceFetcher.Cleanup": (obj: {
    fetchUrl: string;
    sourceHash: string;
    filesPending: number;
    subscriptions: number;
  }) => void;
  "SourceFetcher.FetchFailed": (obj: {
    fetchUrl: string;
    sourceHash: string;
  }) => void;
  "SourceFetcher.FetchingSuccessful": (obj: {
    fetchUrl: string;
    id: string;
    subscriberCount: number;
  }) => void;
}

export const SourcifyEventManager = new EventManager<Events>({
  "*": [],
  "Verification.MatchStored": [],
  "Monitor.Error.CantStart": [],
  "Monitor.Started": [],
  "Monitor.Stopped": [],
  "Monitor.ProcessingBlock": [],
  "Monitor.AlreadyVerified": [],
  "Monitor.NewContract": [],
  "Monitor.Error": [],
  "SourceFetcher.UsingFallback": [],
  "SourceFetcher.NewSubscription": [],
  "SourceFetcher.Cleanup": [],
  "SourceFetcher.FetchFailed": [],
  "SourceFetcher.FetchingSuccessful": [],
});
