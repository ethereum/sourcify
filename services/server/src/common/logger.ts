import { log } from "console";
import { createLogger, transports, format, Logger } from "winston";

const loggerInstance: Logger = createLogger();

const rawlineFormat = format.printf(
  ({ level, message, timestamp, ...metadata }: any) => {
    let msg = `${timestamp} [${level}]: ${message} `;
    if (Object.keys(metadata).length > 0) {
      msg += Object.entries(metadata)
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
        .join(", ");
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
  level:
    process.env.NODE_LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: process.env.NODE_ENV === "production" ? jsonFormat : lineFormat,
});

console.log(consoleTransport.level);
loggerInstance.add(consoleTransport);

export const logger = loggerInstance;

// Function to change the log level dynamically
export function setLogLevel(level: string): void {
  console.log(`Setting log level to: ${level}`);
  logger.warn(`Setting log level to: ${level}`);
  consoleTransport.level = level;
}
