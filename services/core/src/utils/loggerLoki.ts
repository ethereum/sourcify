import dotenv from "dotenv";
import { createLogger, transports, format } from "winston";
import LokiTransport from "winston-loki";

dotenv.config();

const loggerInstance = createLogger();

if (process.env.GRAFANA_LOKI_EXTERNAL_PORT) {
  loggerInstance.add(
    new LokiTransport({
      host: `http://127.0.0.1:${process.env.GRAFANA_LOKI_EXTERNAL_PORT}`,
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
}

loggerInstance.add(
  new transports.Console({
    format: format.combine(
      format((info) => {
        return info.level === "info" ? info : false;
      })(),
      format.timestamp(),
      format.json()
    ),
  })
);

export const logger = loggerInstance;
