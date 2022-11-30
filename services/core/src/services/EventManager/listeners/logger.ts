import { SourcifyEventManager } from "../.";
import { logger } from "../../../utils/loggerLoki";

SourcifyEventManager.on("*", [
  (event: string, argument: any) => {
    logger.info({
      message: argument,
      labels: { type: "logging", event: event },
    });
  },
]);
