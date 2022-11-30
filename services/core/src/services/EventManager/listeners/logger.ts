import { SourcifyEventManager } from "../.";
import { logger } from "../../../utils/loggerLoki";

SourcifyEventManager.on("*", [
  (event: string, argument: any) => {
    if (event.includes("Error")) {
      logger.info({
        message: argument,
        labels: { type: "errors", event: event },
      });
    } else {
      logger.info({
        message: argument,
        labels: { type: "logging", event: event },
      });
    }
  },
]);
