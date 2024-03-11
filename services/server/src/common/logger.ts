import { createLogger, transports, format, Logger } from "winston";
import chalk from "chalk";
import {
  setLibSourcifyLogger,
  setLibSourcifyLoggerLevel,
} from "@ethereum-sourcify/lib-sourcify";

const loggerInstance: Logger = createLogger({
  level:
    process.env.NODE_LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
});

enum LogLevels {
  error = 0,
  warn = 1,
  info = 2,
  debug = 5,
  silly = 6,
}

// 2024-03-06T17:04:16.375Z [warn]: [RepositoryV2Service] Storing contract address=0x5FbDB2315678afecb367f032d93F642f64180aa3, chainId=1337, matchQuality=0.5
const rawlineFormat = format.printf(
  ({ level, message, timestamp, service, ...metadata }: any) => {
    let msg = `${timestamp} [${level}]: ${service ? service : ""} ${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
      msg +=
        " - " +
        Object.entries(metadata)
          .map(([key, value]) => {
            if (typeof value === "object") {
              try {
                value = JSON.stringify(value);
              } catch (e) {
                value = "SerializationError: Unable to serialize object";
              }
            }
            return `${key}=${value}`;
          })
          .join("\t");
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

const consoleTransport = new transports.Console({
  // NODE_LOG_LEVEL is takes precedence, otherwise use "info" if in production, "debug" otherwise
  format: process.env.NODE_ENV === "production" ? jsonFormat : lineFormat,
});

loggerInstance.add(consoleTransport);
const serverLoggerInstance = loggerInstance.child({
  service:
    process.env.NODE_ENV === "production" ? "server" : chalk.blue("[Server]"),
});

export default serverLoggerInstance;

export const logLevelStringToNumber = (level: string): number => {
  switch (level) {
    case "error":
      return LogLevels.error;
    case "warn":
      return LogLevels.warn;
    case "info":
      return LogLevels.info;
    case "debug":
      return LogLevels.debug;
    case "silly":
      return LogLevels.silly;
    default:
      return LogLevels.info;
  }
};

// Function to change the log level dynamically
export function setLogLevel(level: string): void {
  console.log(`Setting log level to: ${level}`);
  serverLoggerInstance.warn(`Setting log level to: ${level}`);
  consoleTransport.level = level;
  // Also set lib-sourcify's logger level
  setLibSourcifyLoggerLevel(logLevelStringToNumber(level));
}

// here we override the standard LibSourcify's Logger with a custom one
setLibSourcifyLogger({
  logLevel: logLevelStringToNumber(serverLoggerInstance.level), // same as the server
  setLevel(level: number) {
    this.logLevel = level;
  },
  log(level, msg, metadata) {
    const logObject = {
      service:
        process.env.NODE_ENV === "production"
          ? "LibSourcify"
          : chalk.cyan("[LibSourcify]"),
      message: msg,
      ...metadata,
    };
    if (level <= this.logLevel) {
      switch (level) {
        case 0:
          serverLoggerInstance.error(logObject);
          break;
        case 1:
          serverLoggerInstance.warn(logObject);
          break;
        case 2:
          serverLoggerInstance.info(logObject);
          break;
        // Use winston's log levels https://github.com/winstonjs/winston?tab=readme-ov-file#logging-levels
        // We don't use http (3) and verbose (4)
        case 5:
          serverLoggerInstance.debug(logObject);
          break;
        case 6:
          serverLoggerInstance.silly(logObject);
          break;
        default:
          serverLoggerInstance.info(logObject);
          break;
      }
    }
  },
});
