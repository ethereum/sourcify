/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
import path from "path";
import { SourcifyEventManager } from "./common/SourcifyEventManager/SourcifyEventManager";
import { logger } from "./common/loggerLoki";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const setRepositoryPath = () => {
  if (process.env.MOCK_REPOSITORY) return process.env.MOCK_REPOSITORY;
  if (process.env.REPOSITORY_PATH)
    return path.resolve(__dirname, process.env.REPOSITORY_PATH);
  logger.warn("REPOSITORY_PATH not set. Using default /tmp/repository.");
  return "/tmp/repository";
};

// TODO: Don't use config.ts at all. Since as a module config is evaluated only once, this can cause changed environment variables not to take effect. E.g. if you run a Monitor and a Server with different REPOSITORY_PATHs, the server will have monitor's repo path since this was already evaluated and won't be run again. Instead these should be put in place in constructors etc.
export default {
  monitor: {
    port: process.env.MONITOR_PORT || 80,
  },
  server: {
    port: process.env.SERVER_PORT || 5000,
    maxFileSize: 30 * 1024 * 1024, // 30 MB
  },
  repository: {
    path: setRepositoryPath(),
  },
  testing: process.env.TESTING || false,
  tag: process.env.TAG || "latest",
  logging: {
    dir: process.env.LOGGING_DIR || "logs",
    level: process.env.LOGGING_LEVEL || "debug",
  },
  session: {
    secret: process.env.SESSION_SECRET || "session top secret",
    maxAge:
      (process.env.SESSION_MAX_AGE && parseInt(process.env.SESSION_MAX_AGE)) ||
      12 * 60 * 60 * 1000, // 12 hrs in millis
    secure:
      process.env.NODE_ENV === "production" && process.env.TESTING !== "true", // Set Secure in the Set-Cookie header i.e. require https
  },
  corsAllowedOrigins: [
    /^https?:\/\/(?:.+\.)?sourcify.dev$/, // sourcify.dev and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth$/, // sourcify.eth and subdomains
    /^https?:\/\/(?:.+\.)?sourcify.eth.link$/, // sourcify.eth.link and subdomains
    /^https?:\/\/(?:.+\.)?ipfs.dweb.link$/, // dweb links used by Brave browser etc.
    process.env.NODE_ENV === "development" && /^https?:\/\/localhost(?::\d+)?$/, // localhost on any port
  ],
};
