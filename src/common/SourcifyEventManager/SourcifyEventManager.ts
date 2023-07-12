import { Match } from "@ethereum-sourcify/lib-sourcify";
import { EventManager, GenericEvents } from "../EventManager";

interface Events extends GenericEvents {
  "*": (event: string, argument: any) => void;
  "Verification.MatchStored": (match: Match) => void;
  "Server.SourcifyChains.Warn": (obj: { message: string }) => void;
  "Monitor.Error.CantStart": (e: { chainId: string; message: string }) => void;
  "Monitor.Started": (obj: {
    chainId: string;
    lastBlockNumber: number;
    startBlock: number;
  }) => void;
  "Monitor.Stopped": (chainId: string) => void;
  "Monitor.ProcessingBlock": (obj: {
    blockNumber: number;
    chainId: string;
    getBlockPause: number;
  }) => void;
  "Monitor.Verified": (match: Match) => void;
  "Monitor.AlreadyVerified": (obj: {
    address: string;
    chainId: string;
  }) => void;
  "Monitor.NewContract": (obj: { address: string; chainId: string }) => void;
  "Monitor.Error": (obj: { message: string; stack?: string }) => void;
  "Monitor.Error.ProcessingBlock": (obj: {
    message: string;
    stack: string;
    blockNumber: number;
    chainId: string;
  }) => void;
  "Monitor.Error.ProcessingBytecode": (obj: {
    message: string;
    stack: string;
    chainId: string;
    address: string;
  }) => void;
  "Monitor.Error.GettingBytecode": (obj: {
    message: string;
    stack: string;
    chainId: string;
    address: string;
  }) => void;
  "Monitor.Error.VerifyError": (obj: {
    message: string;
    stack: string;
    chainId: string;
    address: string;
  }) => void;
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
  "Server.SourcifyChains.Warn": [],
  "Monitor.Error.CantStart": [],
  "Monitor.Started": [],
  "Monitor.Stopped": [],
  "Monitor.ProcessingBlock": [],
  "Monitor.Verified": [],
  "Monitor.AlreadyVerified": [],
  "Monitor.NewContract": [],
  "Monitor.Error": [],
  "Monitor.Error.ProcessingBlock": [],
  "Monitor.Error.ProcessingBytecode": [],
  "Monitor.Error.GettingBytecode": [],
  "Monitor.Error.VerifyError": [],
  "SourceFetcher.UsingFallback": [],
  "SourceFetcher.NewSubscription": [],
  "SourceFetcher.Cleanup": [],
  "SourceFetcher.FetchFailed": [],
  "SourceFetcher.FetchingSuccessful": [],
});
