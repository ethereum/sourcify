import { SourcifyEventManager } from "..";
import { logger } from "../../../utils/loggerLoki";
import { Match } from "../../../utils/types";

SourcifyEventManager.on("Injector.MatchStored", [
  (match: Match) => {
    logger.info({
      message: match,
      labels: {
        type: "event",
        event: "Injector.MatchStored",
      },
    });
  },
]);
