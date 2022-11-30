import {
  GenericListenersInterface,
  EventManager,
} from "../../utils/EventManager";
import { Match } from "../../utils/types";

interface ListenersInterface extends GenericListenersInterface {
  "*": ((event: string, argument: any) => void)[];
  "Server.ApiReplied": ((apiEvent: {
    api: string;
    success: boolean;
    parameters: any;
    response: any;
  }) => void)[];
  "Injector.MatchStored": ((match: Match) => void)[];
}

export const SourcifyEventManager = new EventManager<ListenersInterface>({
  "*": [],
  "Server.ApiReplied": [],
  "Injector.MatchStored": [],
});
