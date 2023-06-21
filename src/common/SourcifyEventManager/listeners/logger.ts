import { SourcifyEventManager } from "../SourcifyEventManager";
import { logger } from "../../loggerLoki";

SourcifyEventManager.on("*", [
  (event: string, argument: any) => {
    if (event.includes("Error")) {
      logger.error({
        message: argument,
        labels: { level: "error", event: event },
      });
    } else {
      logger.info({
        message: argument,
        labels: { level: "info", event: event },
      });
    }
  },
]);
