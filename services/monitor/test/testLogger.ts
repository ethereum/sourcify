import { createLogger, transports, format } from "winston";
const logger = createLogger();

// Define the ANSI code for magenta text
const magenta = "\x1b[35m";

// Reset color
const reset = "\x1b[0m";

const myFormat = format.printf(
  (info: {
    level: string;
    message: string;
    timestamp?: string;
    labels?: { event: string; level: string };
    prefix?: string;
  }) => {
    return `${info.timestamp} ${magenta}[TEST]${reset} ${info.level}: ${
      info.prefix ? `[${info.prefix}] -` : ""
    } ${info.message}`;
  }
);

logger.add(
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.errors({ stack: true }),
      myFormat
    ),
  })
);

export default logger;
