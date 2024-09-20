// !!! SHOULD NOT BE IMPORTED IN ANY OTHER MODULES on top of the files
// Module to be run when running the server from the CLI

import path from "path";
// First env vars need to be loaded before config
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
// Make sure config is relative to index.ts and not where the server is run from
process.env["NODE_CONFIG_DIR"] = path.resolve(__dirname, "..", "config");
import config from "config";
import swaggerUi from "swagger-ui-express";
import yamljs from "yamljs";
import expressSession from "express-session";
import createMemoryStore from "memorystore";
import { Pool } from "pg";
import genFunc from "connect-pg-simple";

// local imports
import logger from "../common/logger";
import { sourcifyChainsMap } from "../sourcify-chains";
import { Server } from "./server";
import { ChainRepository } from "../sourcify-chain-repository";
import { ISolidityCompiler } from "@ethereum-sourcify/lib-sourcify";
import { SolcLambdaWithLocalFallback } from "./services/compiler/lambda-with-fallback/SolcLambdaWithLocalFallback";
import { SolcLocal } from "./services/compiler/local/SolcLocal";
import session from "express-session";

// Supported Chains

const chainRepository = new ChainRepository(sourcifyChainsMap);

logger.info("SourcifyChains.Initialized", {
  supportedChainsCount: chainRepository.supportedChainsArray.length,
  allChainsCount: chainRepository.sourcifyChainsArray.length,
  supportedChains: chainRepository.supportedChainsArray.map((c) => c.chainId),
  allChains: chainRepository.sourcifyChainsArray.map((c) => c.chainId),
});

// Solidity Compiler

const solcRepoPath =
  (config.get("solcRepo") as string) || path.join("/tmp", "solc-repo");
const solJsonRepoPath =
  (config.get("solJsonRepo") as string) || path.join("/tmp", "soljson-repo");

let selectedSolidityCompiler: ISolidityCompiler;
if (config.get("lambdaCompiler.enabled")) {
  logger.info("Using lambda solidity compiler with local fallback");
  if (
    process.env.AWS_REGION === undefined ||
    process.env.AWS_ACCESS_KEY_ID === undefined ||
    process.env.AWS_SECRET_ACCESS_KEY === undefined
  ) {
    throw new Error(
      "AWS credentials not set. Please set them to run the compiler on AWS Lambda.",
    );
  }
  selectedSolidityCompiler = new SolcLambdaWithLocalFallback(
    process.env.AWS_REGION as string,
    process.env.AWS_ACCESS_KEY_ID as string,
    process.env.AWS_SECRET_ACCESS_KEY as string,
    config.get("lambdaCompiler.functionName"),
    solcRepoPath,
    solJsonRepoPath,
  );
} else {
  logger.info("Using local solidity compiler");
  selectedSolidityCompiler = new SolcLocal(solcRepoPath, solJsonRepoPath);
}

export const solc = selectedSolidityCompiler;

// To print regexes in the config object logs below
Object.defineProperty(RegExp.prototype, "toJSON", {
  value: RegExp.prototype.toString,
});
// Start Server
logger.info("Starting server with config", {
  config: JSON.stringify(config.util.toObject(), null, 2),
});
const server = new Server(
  {
    port: config.get("server.port"),
    maxFileSize: config.get("server.maxFileSize"),
    rateLimit: {
      enabled: config.get("rateLimit.enabled"),
      windowMs: config.get("rateLimit.enabled")
        ? config.get("rateLimit.windowMs")
        : undefined,
      max: config.get("rateLimit.enabled")
        ? config.get("rateLimit.max")
        : undefined,
      whitelist: config.get("rateLimit.enabled")
        ? config.get("rateLimit.whitelist")
        : undefined,
    },
    corsAllowedOrigins: config.get("corsAllowedOrigins"),
    solc,
    chains: chainRepository.sourcifyChainMap,
    verifyDeprecated: config.get("verifyDeprecated"),
    sessionOptions: getSessionOptions(),
  },
  {
    initCompilers: config.get("initCompilers") || false,
    solcRepoPath,
    solJsonRepoPath,
  },
  {
    enabledServices: {
      read: config.get("storage.read"),
      writeOrWarn: config.get("storage.writeOrWarn"),
      writeOrErr: config.get("storage.writeOrErr"),
    },
    repositoryV1ServiceOptions: {
      ipfsApi: process.env.IPFS_API as string,
      repositoryPath: config.get("repositoryV1.path"),
      repositoryServerUrl: config.get("repositoryV1.serverUrl") as string,
    },
    repositoryV2ServiceOptions: {
      ipfsApi: process.env.IPFS_API as string,
      repositoryPath: config.has("repositoryV2.path")
        ? config.get("repositoryV2.path")
        : undefined,
    },
    sourcifyDatabaseServiceOptions: {
      postgres: {
        host: process.env.SOURCIFY_POSTGRES_HOST as string,
        database: process.env.SOURCIFY_POSTGRES_DB as string,
        user: process.env.SOURCIFY_POSTGRES_USER as string,
        password: process.env.SOURCIFY_POSTGRES_PASSWORD as string,
        port: parseInt(process.env.SOURCIFY_POSTGRES_PORT || "5432"),
      },
    },
    allianceDatabaseServiceOptions: {
      postgres: {
        host: process.env.ALLIANCE_POSTGRES_HOST as string,
        database: process.env.ALLIANCE_POSTGRES_DB as string,
        user: process.env.ALLIANCE_POSTGRES_USER as string,
        password: process.env.ALLIANCE_POSTGRES_PASSWORD as string,
        port: parseInt(process.env.ALLIANCE_POSTGRES_PORT || "5432"),
      },
    },
  },
);

// Generate the swagger.json and serve it with SwaggerUI at /api-docs
server.services.init().then(() => {
  server
    .loadSwagger(yamljs.load(path.join(__dirname, "..", "openapi.yaml"))) // load the openapi file with the $refs resolved
    .then((swaggerDocument: any) => {
      server.app.get("/api-docs/swagger.json", (req, res) =>
        res.json(swaggerDocument),
      );
      server.app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument, {
          customSiteTitle: "Sourcify API",
          customfavIcon: "https://sourcify.dev/favicon.ico",
        }),
      );
      server.app.listen(server.port, () => {
        logger.info("Server listening", { port: server.port });
      });
    });
});

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

export function getSessionOptions(): session.SessionOptions {
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
