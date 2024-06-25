import expressSession from "express-session";
import createMemoryStore from "memorystore";
import { Pool } from "pg";
import genFunc from "connect-pg-simple";
import config from "config";
import session from "express-session";

import logger from "../common/logger";
import { NextFunction, Request, Response } from "express";

function initMemoryStore() {
  const MemoryStore = createMemoryStore(expressSession);

  logger.warn(
    "Using memory based session. Don't use memory session in production!",
  );
  return new MemoryStore({
    checkPeriod: config.get("session.maxAge"),
  });
}

function initDatabaseStore() {
  const pool = new Pool({
    host: process.env.SOURCIFY_POSTGRES_HOST,
    database: process.env.SOURCIFY_POSTGRES_DB,
    user: process.env.SOURCIFY_POSTGRES_USER,
    password: process.env.SOURCIFY_POSTGRES_PASSWORD,
    port: parseInt(process.env.SOURCIFY_POSTGRES_PORT || "5432"),
  });

  // This listener is necessary otherwise the sourcify process crashes if the database is closed
  pool.prependListener("error", (e) => {
    logger.error("Database connection lost for session pool", {
      error: e,
    });
    throw new Error("Database connection lost for session pool");
  });

  const PostgresqlStore = genFunc(expressSession);

  logger.info("Using database based session");
  return new PostgresqlStore({
    pool: pool,
    // Pruning expired sessions every 12 hours
    pruneSessionInterval: 12 * 60 * 60,
  });
}

function getSessionStore() {
  const sessionStoreType = config.get("session.storeType");

  switch (sessionStoreType) {
    case "database": {
      if (
        process.env.SOURCIFY_POSTGRES_HOST &&
        process.env.SOURCIFY_POSTGRES_DB &&
        process.env.SOURCIFY_POSTGRES_USER &&
        process.env.SOURCIFY_POSTGRES_PASSWORD
      ) {
        return initDatabaseStore();
      } else {
        logger.error(
          "Database session enabled in config but the environment variables are not specified",
        );
        throw new Error(
          "Database session enabled in config but the environment variables are not specified",
        );
      }
    }

    case "memory": {
      return initMemoryStore();
    }
    default:
      // Throw an error if an unrecognized session storage type is selected
      throw new Error(
        `Selected session storage type '${sessionStoreType}' doesn't exist.`,
      );
  }
}

function getSessionOptions(): session.SessionOptions {
  if (config.get("session.secret") === "CHANGE_ME") {
    const msg =
      "The session secret is not set, please set it in the config file";
    process.env.NODE_ENV === "production"
      ? logger.error(msg)
      : logger.warn(msg);
  }
  return {
    secret: config.get("session.secret"),
    name: "sourcify_vid",
    rolling: true,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: config.get("session.maxAge"),
      secure: config.get("session.secure"),
      sameSite: "lax",
    },
    store: getSessionStore(),
  };
}

export default function getSessionMiddleware() {
  const sessionMiddleware = session(getSessionOptions());
  // We need to wrap the sessionMiddleware in a middleware to prevent it from returning all the postgresql errors in the 500 request
  return (req: Request, res: Response, next: NextFunction) => {
    sessionMiddleware(req, res, (error) => {
      if (error) {
        logger.error("Cannot store session", {
          error,
        });
        res.status(500).send("Cannot store session");
      } else {
        next();
      }
    });
  };
}
