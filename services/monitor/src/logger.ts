import { createLogger, transports, format } from "winston";

const logger = createLogger();

const myFormat = format.printf(
  (info: {
    level: string;
    message: string;
    timestamp?: string;
    labels?: { event: string; level: string };
    prefix?: string;
  }) => {
    return `${info.timestamp} [${info.level}]: ${
      info.prefix ? `[${info.prefix}] -` : ""
    } ${info.message}`;
  }
);

logger.add(
  new transports.Console({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.errors({ stack: true }),
      myFormat
    ),
  })
);

export default logger;
