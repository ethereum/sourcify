import rimraf from "rimraf";
import { resetDatabase } from "../helpers/helpers";
import { Server } from "../../src/server/server";
import config from "config";
import http from "http";
import { sourcifyChainsMap } from "../../src/sourcify-chains";
import {
  RWStorageIdentifiers,
  StorageIdentifiers,
} from "../../src/server/services/storageServices/identifiers";
import { Pool } from "pg";
import { SourcifyDatabaseService } from "../../src/server/services/storageServices/SourcifyDatabaseService";
import { ChainRepository } from "../../src/sourcify-chain-repository";
import path from "path";
import { ISolidityCompiler } from "@ethereum-sourcify/lib-sourcify";
import logger from "../../src/common/logger";
import { SolcLambdaWithLocalFallback } from "../../src/server/services/compiler/lambda-with-fallback/SolcLambdaWithLocalFallback";
import { SolcLocal } from "../../src/server/services/compiler/local/SolcLocal";
import session from "express-session";
import genFunc from "connect-pg-simple";
import createMemoryStore from "memorystore";

const supportedChainsMap = new ChainRepository(sourcifyChainsMap).supportedChainMap;

export type ServerFixtureOptions = {
  port: number;
  read: RWStorageIdentifiers;
  writeOrWarn: StorageIdentifiers[];
  writeOrErr: StorageIdentifiers[];
  skipDatabaseReset: boolean;
};

export class ServerFixture {
  identifier: StorageIdentifiers | undefined;
  readonly maxFileSize = config.get<number>("server.maxFileSize");

  private _server?: Server;

  // Getters for type safety
  // Can be safely accessed in "it" blocks
  get sourcifyDatabase(): Pool {
    // sourcifyDatabase is just a shorter way to get databasePool inside SourcifyDatabaseService
    const _sourcifyDatabase = (
      this.server.services.storage.rwServices[
        RWStorageIdentifiers.SourcifyDatabase
      ] as SourcifyDatabaseService
    ).databasePool;
    if (!_sourcifyDatabase)
      throw new Error("sourcifyDatabase not initialized!");
    return _sourcifyDatabase;
  }
  get server(): Server {
    if (!this._server) throw new Error("server not initialized!");
    return this._server;
  }

  /**
   * Creates a server instance for testing with the specified configuration.
   * Expected to be called in a "describe" block.
   * Any tests that may need a different server configuration can be written
   * in a different "describe" block.
   */
  constructor(options_?: Partial<ServerFixtureOptions>) {
    let httpServer: http.Server;

    const options: ServerFixtureOptions = {
      ...{
        port: config.get("server.port"),
        read: config.get("storage.read"),
        writeOrWarn: config.get("storage.writeOrWarn"),
        writeOrErr: config.get("storage.writeOrErr"),
        skipDatabaseReset: false,
      },
      ...options_,
    };

    before(async () => {
      process.env.SOURCIFY_POSTGRES_PORT =
        process.env.DOCKER_HOST_POSTGRES_TEST_PORT || "5431";

      if (
        !process.env.SOURCIFY_POSTGRES_HOST ||
        !process.env.SOURCIFY_POSTGRES_DB ||
        !process.env.SOURCIFY_POSTGRES_USER ||
        !process.env.SOURCIFY_POSTGRES_PASSWORD ||
        !process.env.SOURCIFY_POSTGRES_PORT
      ) {
        throw new Error("Not all required environment variables set");
      }

      // Set up the solidity compiler
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
    
      const solc = selectedSolidityCompiler;

      this._server = new Server(
        {
          port: options.port,
          maxFileSize: this.maxFileSize,
          rateLimit: config.get("rateLimit"),
          corsAllowedOrigins: config.get("corsAllowedOrigins"),
          solc,
          chains: sourcifyChainsMap,
          verifyDeprecated: config.get("verifyDeprecated"),
          sessionOptions: getSessionOptions(),
        },
        {
          supportedChainsMap,
          solcRepoPath,
          solJsonRepoPath,
        },
        {
          enabledServices: {
            read: options.read,
            writeOrWarn: options.writeOrWarn,
            writeOrErr: options.writeOrErr,
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
              port: parseInt(process.env.SOURCIFY_POSTGRES_PORT),
            },
          },
        },
      );

      await this._server.services.init();

      await new Promise<void>((resolve, reject) => {
        httpServer = this.server.app.listen(this.server.port, resolve);
        httpServer.on("error", reject);
      });
      console.log(`Server listening on port ${this.server.port}!`);
    });

    beforeEach(async () => {
      rimraf.sync(config.get('repositoryV1.path'));
      rimraf.sync(config.get('repositoryV2.path'));
      if (!options.skipDatabaseReset) {
        await resetDatabase(this.sourcifyDatabase);
        console.log("Resetting SourcifyDatabase");
      }
    });

    after(() => {
      httpServer.close();
      rimraf.sync(config.get('repositoryV1.path'));
      rimraf.sync(config.get('repositoryV2.path'));
    });
  }
}

function initMemoryStore() {
  const MemoryStore = createMemoryStore(session);

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

  const PostgresqlStore = genFunc(session);

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
