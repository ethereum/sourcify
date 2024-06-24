import { createLogger, transports, format } from "winston";

export const logger = createLogger();

// Define the ANSI code for magenta text
const magenta = "\x1b[35m";

// Reset color
const reset = "\x1b[0m";

const myFormat = format.printf((info) => {
  return `${info.timestamp} ${magenta}[TEST]${reset} ${info.level}: ${
    info.prefix ? `[${info.prefix}] -` : ""
  } ${info.message}`;
});

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
