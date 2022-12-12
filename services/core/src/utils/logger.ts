import * as fs from "fs";
import * as bunyan from "bunyan";
import path from "path";

export const Logger = (name?: string, logDir?: any) => {
  const loggerName = name || "Sourcify";
  const logger: bunyan = bunyan.createLogger({
    name: loggerName,
    streams: [
      {
        stream: process.stdout,
        level: "info",
      },
    ],
  });

  if (logDir) {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    logger.addStream({
      path: path.resolve(logDir, loggerName + ".log"),
      level: "info",
    });
  }

  return logger;
};
