import dotenv from "dotenv";
import { createLogger, transports, format } from "winston";
import LokiTransport from "winston-loki";

dotenv.config();

const loggerInstance = createLogger();

// Enable loki only if GRAFANA_LOKI_URL is defined
if (process.env.GRAFANA_LOKI_URL) {
  loggerInstance.add(
    new LokiTransport({
      host: process.env.GRAFANA_LOKI_URL,
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
