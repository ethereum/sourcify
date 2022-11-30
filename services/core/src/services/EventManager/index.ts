import { EventManager, GenericEvents } from "../../utils/EventManager";
import { Match } from "../../utils/types";
interface Events extends GenericEvents {
  "*": (event: string, argument: any) => void;
  "Server.ApiReplied": (apiEvent: {
    api: string;
    success: boolean;
    parameters: any;
    response: any;
  }) => void;
  "Injector.MatchStored": (match: Match) => void;
}

export const SourcifyEventManager = new EventManager<Events>({
  "*": [],
  "Server.ApiReplied": [],
  "Injector.MatchStored": [],
});
