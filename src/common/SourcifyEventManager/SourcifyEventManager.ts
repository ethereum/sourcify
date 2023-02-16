import { Match } from "@ethereum-sourcify/lib-sourcify";
import { EventManager, GenericEvents } from "../EventManager";

interface ErrorEvent {
  message: string;
  details?: any;
  stack?: string;
}

interface ServerErrorEvent extends ErrorEvent {
  request: {
    api: string;
    parameters: any;
  };
}
interface Events extends GenericEvents {
  "*": (event: string, argument: any) => void;
  "Core.Error": (errorEvent: ErrorEvent) => void;
  "Core.PerformFetch": (fetchEvent: {
    url: string;
    hash?: string;
    fileName?: string;
  }) => void;
  "Validation.Error": (errorEvent: ErrorEvent) => void;
  "Verification.Error": (errorEvent: ErrorEvent) => void;
  "Verification.GotSolcJS": (getSolcJSEvent: {
    source: "local" | "remote";
    version: string;
  }) => void;
  "Verification.GotSolcGithub": (getSolcGithubEvent: {
    source: "local" | "remote";
    version: string;
    url: string;
  }) => void;
  "Verification.Compiled": (compiledEvent: {
    version: string;
    solcPath: string | null;
  }) => void;
  "Verification.CreatorTxFetched": (creatorTxFetchedEvent: {
    chainId: string;
    address: string;
  }) => void;
  "Verification.ExecutionBytecodeFetched": (executionBytecodeFetchedEvent: {
    chain: string;
    address: string;
  }) => void;
  "Verification.MatchCompared": (matchComparedEvent: {
    chain: string;
    address: string;
    match: Match;
  }) => void;
  "Verification.MatchStored": (match: Match) => void;
  "Server.Error": (errorEvent: ServerErrorEvent) => void;
  "Server.Started": (serverStartedEvent: { port: number | string }) => void;
  "Server.ApiReplied": (apiEvent: {
    api: string;
    status: number;
    parameters: any;
    response: any;
  }) => void;
  "Monitor.Error": (errorEvent: ErrorEvent) => void;
  "Monitor.Started": (monitorStartedEvent: {
    web3url: string;
    lastBlockNumber: number;
    startBlock: number;
  }) => void;
  "Monitor.Stopped": () => void;
  "Monitor.WaitingNewBlocks": (waitingNewBlocksEvent: {
    blockNumber: number;
    getBlockPause: number;
  }) => void;
  "Monitor.AlreadyVerified": (AlreadyVerifiedEvent: {
    address: string;
    chainId: string;
  }) => void;
  "Monitor.NewContract": (NewContractEvent: {
    address: string;
    chainId: string;
  }) => void;
  "Monitor.SourceFetcher.FetchingSuccessful": (FetchingSuccessfulEvent: {
    fetchUrl: string;
    id: string;
    subscribers: number;
  }) => void;
  "Monitor.SourceFetcher.NewSubscription": (NewSubscriptionEvent: {
    fetchUrl: string;
    sourceHash: string;
    filesPending: number;
    subscriptions: number;
  }) => void;
  "Monitor.SourceFetcher.Cleanup": (CleanupEvent: {
    fetchUrl: string;
    sourceHash: string;
    filesPending: number;
    subscriptions: number;
  }) => void;
}

export const SourcifyEventManager = new EventManager<Events>({
  "*": [],
  "Core.Error": [],
  "Core.PerformFetch": [],
  "Validation.Error": [],
  "Verification.Error": [],
  "Verification.GotSolcJS": [],
  "Verification.GotSolcGithub": [],
  "Verification.Compiled": [],
  "Verification.CreatorTxFetched": [],
  "Verification.ExecutionBytecodeFetched": [],
  "Verification.MatchCompared": [],
  "Verification.MatchStored": [],
  "Server.Error": [],
  "Server.Started": [],
  "Server.ApiReplied": [],
  "Monitor.Error": [],
  "Monitor.Started": [],
  "Monitor.Stopped": [],
  "Monitor.WaitingNewBlocks": [],
  "Monitor.AlreadyVerified": [],
  "Monitor.NewContract": [],
  "Monitor.SourceFetcher.FetchingSuccessful": [],
  "Monitor.SourceFetcher.NewSubscription": [],
  "Monitor.SourceFetcher.Cleanup": [],
});
