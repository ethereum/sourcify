/* eslint-disable no-useless-escape */

import { SourcifyEventManager } from "@ethereum-sourcify/core";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "environments/.env") });

const setRepositoryPath = () => {
  if (process.env.MOCK_REPOSITORY) return process.env.MOCK_REPOSITORY;
  if (process.env.REPOSITORY_PATH)
    return path.resolve(__dirname, process.env.REPOSITORY_PATH);
  SourcifyEventManager.trigger("Error", {
    message: "No repository path set, using /tmp/repository",
  });
  return "/tmp/repository";
};

export default {
  monitor: {
    port: process.env.MONITOR_PORT || 80,
  },
  server: {
    port: process.env.SERVER_PORT || 5000,
    maxFileSize: 30 * 1024 * 1024, // 30 MB
    etherscanAPIKey: process.env.ETHERSCAN_API_KEY,
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
