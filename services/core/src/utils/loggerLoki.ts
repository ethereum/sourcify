import { createLogger, transports, format } from "winston";
import LokiTransport from "winston-loki";

const loggerInstance = createLogger();

loggerInstance.add(
  new LokiTransport({
    host: "http://127.0.0.1:3100",
    basicAuth: "username:password",
    json: true,
    format: format.combine(
      format((info) => {
        const MESSAGE = Symbol.for("message");
        info[MESSAGE as any] = JSON.stringify(info.message);
        return info;
      })()
    ),
  })
);

loggerInstance.add(
  new transports.Console({
    format: format.combine(format.timestamp(), format.json()),
  })
);

export const logger = loggerInstance;
