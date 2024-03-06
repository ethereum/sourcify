import { createLogger, transports, format } from "winston";

const loggerInstance = createLogger();

const rawlineFormat = format.printf(
  ({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg +=
        " - " +
        Object.entries(metadata)
          .map(([key, value]) => `${key}=${value}`)
          .join(" ");
    }
    return msg;
  }
);

const lineFormat = format.combine(
  format.timestamp(),
  format.colorize(),
  rawlineFormat
);

const jsonFormat = format.combine(format.timestamp(), format.json());

loggerInstance.add(
  new transports.Console({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: process.env.NODE_ENV === "production" ? jsonFormat : lineFormat,
  })
);

export const logger = loggerInstance;
