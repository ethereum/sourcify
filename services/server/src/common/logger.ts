import dotenv from "dotenv";
import { createLogger, transports, format } from "winston";

dotenv.config();

const loggerInstance = createLogger();

const myFormat = format.printf(
  (info: {
    level: string;
    message: string;
    timestamp?: string;
    prefix?: string;
  }) => {
    return `${info.timestamp} [${info.level}]: [Server] - ${
      info.prefix ? `[${info.prefix}] -` : ""
    } ${info.message}`;
  }
);

loggerInstance.add(
  new transports.Console({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: format.combine(format.colorize(), format.timestamp(), myFormat),
  })
);

export const logger = loggerInstance;
