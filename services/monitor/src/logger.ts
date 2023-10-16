import { setLibSourcifyLogger } from "@ethereum-sourcify/lib-sourcify";
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

// Override lib-sourcify logger
setLibSourcifyLogger({
  // No need to set again the logger level because it's set here
  logLevel: process.env.NODE_ENV === "production" ? 3 : 4,
  setLevel(level: number) {
    this.logLevel = level;
  },
  log(level, message) {
    if (level <= this.logLevel) {
      switch (level) {
        case 1:
          logger.error({
            level,
            message,
            prefix: "LibSourcify",
          });
          break;
        case 2:
          logger.warn({
            level,
            message,
            prefix: "LibSourcify",
          });
          break;
        case 3:
          logger.info({
            level,
            message,
            prefix: "LibSourcify",
          });
          break;
        case 4:
          logger.debug({
            level,
            message,
            prefix: "LibSourcify",
          });
          break;
      }
    }
  },
});

export default logger;
