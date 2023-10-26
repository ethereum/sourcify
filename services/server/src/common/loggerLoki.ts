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

const myFormat = format.printf(
  (info: {
    level: string;
    message: string;
    timestamp?: string;
    labels?: { event: string; level: string };
  }) => {
    return `${info.timestamp} [${info.level}]: ${
      info.labels?.event
        ? `[${info.labels?.event}] - ${JSON.stringify(info.message)}`
        : info.message
    }`;
  }
);

if (!process.env.GRAFANA_LOKI_URL) {
  loggerInstance.add(
    new transports.Console({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      format: format.combine(format.colorize(), format.timestamp(), myFormat),
    })
  );
}
export const logger = loggerInstance;
