import { SourcifyEventManager } from "..";
import { logger } from "../loggerLoki";
import { Match } from "@ethereum-sourcify/lib-sourcify";

SourcifyEventManager.on("Verification.MatchStored", [
  (match: Match) => {
    logger.info({
      message: match,
      labels: {
        type: "event",
        event: "Verification.MatchStored",
      },
    });
  },
]);
