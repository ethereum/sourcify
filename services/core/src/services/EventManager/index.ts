import { EventManager, GenericEvents } from "../../utils/EventManager";
import { Match } from "../../utils/types";
interface Events extends GenericEvents {
  "*": (event: string, argument: any) => void;
  "Server.Error": (errorEvent: {
    message: string;
    stack: string;
    request: {
      api: string;
      parameters: any;
    };
  }) => void;
  "Server.ApiReplied": (apiEvent: {
    api: string;
    status: number;
    parameters: any;
    response: any;
  }) => void;
  "Injector.MatchStored": (match: Match) => void;
}

export const SourcifyEventManager = new EventManager<Events>({
  "*": [],
  "Server.Error": [],
  "Server.ApiReplied": [],
  "Injector.MatchStored": [],
});
