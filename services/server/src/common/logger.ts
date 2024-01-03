import { createLogger, transports, format } from "winston";
import chalk from "chalk";

const loggerInstance = createLogger();

const myFormat = format.printf(
  (info: {
    level: string;
    message: string;
    timestamp?: string;
    prefix?: string;
  }) => {
    return `${info.timestamp} ${chalk.cyan("[Server]")} [${info.level}]: ${
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
