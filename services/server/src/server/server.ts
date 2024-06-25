import path from "path";
// First env vars need to be loaded before config
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
// Make sure config is relative to server.ts and not where the server is run from
process.env["NODE_CONFIG_DIR"] = path.resolve(__dirname, "..", "config");
import config from "config";
import express, { Request } from "express";
import cors from "cors";
import util from "util";
import * as OpenApiValidator from "express-openapi-validator";
import swaggerUi from "swagger-ui-express";
import yamljs from "yamljs";
import { resolveRefs } from "json-refs";
import { getAddress } from "ethers";
import bodyParser from "body-parser";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fileUpload = require("express-fileupload");
import {
  MemoryStore as ExpressRateLimitMemoryStore,
  rateLimit,
} from "express-rate-limit";
import crypto from "crypto";
import serveIndex from "serve-index";
import { v4 as uuidv4 } from "uuid";
import { asyncLocalStorage } from "../common/async-context";

// local imports
import logger from "../common/logger";
import routes from "./routes";
import genericErrorHandler from "../common/errors/GenericErrorHandler";
import {
  checkSourcifyChainId,
  checkSupportedChainId,
} from "../sourcify-chains";
import {
  validateAddresses,
  validateSingleAddress,
  validateSourcifyChainIds,
} from "./common";
import { initDeprecatedRoutes } from "./deprecated.routes";
import getSessionMiddleware from "./session";
import { Services } from "./services/services";
import { supportedChainsMap } from "../sourcify-chains";
import { SourcifyChainMap } from "@ethereum-sourcify/lib-sourcify";
import { StorageServiceOptions } from "./services/StorageService";

declare module "express-serve-static-core" {
  interface Request {
    services: Services;
  }
}

export class Server {
  app: express.Application;
  repository: string = config.get("repositoryV1.path");
  repositoryV2: string = config.get("repositoryV2.path");
  port: string | number;
  services: Services;

  // TODO: pass config as object into the constructor. Currently we read config from config files. Server Class itself should be configurable.
  constructor(
    port: string | number,
    verificationServiceOption: SourcifyChainMap,
    storageServiceOptions: StorageServiceOptions,
  ) {
    // To print regexes in the logs
    Object.defineProperty(RegExp.prototype, "toJSON", {
      value: RegExp.prototype.toString,
    });

    logger.info("Starting server with config", {
      config: JSON.stringify(config, null, 2),
    });

    this.port = port;
    logger.info("Server port set", { port: this.port });
    this.app = express();

    this.services = new Services(
      verificationServiceOption,
      storageServiceOptions,
    );
    this.app.use((req, res, next) => {
      req.services = this.services;
      next();
    });

    this.app.use(
      bodyParser.urlencoded({
        limit: config.get("server.maxFileSize"),
        extended: true,
      }),
    );
    this.app.use(bodyParser.json({ limit: config.get("server.maxFileSize") }));

    // Init deprecated routes before OpenApiValidator so that it can handle the request with the defined paths.
    // initDeprecatedRoutes is a middleware that replaces the deprecated paths with the real ones.
    initDeprecatedRoutes(this.app);

    this.app.use(
      fileUpload({
        limits: { fileSize: config.get("server.maxFileSize") },
        abortOnLimit: true,
      }),
    );

    // Inject the requestId to the AsyncLocalStorage to be logged.
    this.app.use((req, res, next) => {
      // create a new id if it doesn't exist. Should be assigned by the nginx in production.
      if (!req.headers["x-request-id"]) {
        req.headers["x-request-id"] = uuidv4();
      }

      // Apparently req.headers can be an array
      const requestId = Array.isArray(req.headers["x-request-id"])
        ? req.headers["x-request-id"][0]
        : req.headers["x-request-id"];

      const context = { requestId };
      // Run the rest of the request stack in the context of the requestId
      asyncLocalStorage.run(context, () => {
        next();
      });
    });

    // Log all requests in trace mode
    this.app.use((req, res, next) => {
      const { method, path, params, headers, body } = req;
      logger.silly("Request", { method, path, params, headers, body });
      next();
    });

    // In every request support both chain and chainId
    this.app.use((req: any, res: any, next: any) => {
      if (req.body.chainId) {
        req.body.chain = req.body.chainId;
      }
      next();
    });

    this.app.use(
      OpenApiValidator.middleware({
        apiSpec: path.join(__dirname, "..", "openapi.yaml"),
        validateRequests: {
          allowUnknownQueryParameters: false,
        },
        validateResponses: false,
        ignoreUndocumented: true,
        fileUploader: false,
        validateSecurity: {
          handlers: {
            // Auth Handler for the /change-log-level endpoint
            BearerAuth: (req) => {
              const authHeader = req.headers["authorization"];
              // This is a placeholder token. In a real application, use a more secure method for managing and validating tokens.
              const token = authHeader && authHeader.split(" ")[1];

              return token === process.env.SETLOGGING_TOKEN;
            },
          },
        },
        formats: {
          "comma-separated-addresses": {
            type: "string",
            validate: (addresses: string) => validateAddresses(addresses),
          },
          address: {
            type: "string",
            validate: (address: string) => validateSingleAddress(address),
          },
          "comma-separated-sourcify-chainIds": {
            type: "string",
            validate: (chainIds: string) => validateSourcifyChainIds(chainIds),
          },
          "supported-chainId": {
            type: "string",
            validate: (chainId: string) => checkSupportedChainId(chainId),
          },
          // "Sourcify chainIds" include the chains that are revoked verification support, but can have contracts in the repo.
          "sourcify-chainId": {
            type: "string",
            validate: (chainId: string) => checkSourcifyChainId(chainId),
          },
          "match-type": {
            type: "string",
            validate: (matchType: string) =>
              matchType === "full_match" || matchType === "partial_match",
          },
        },
      }),
    );
    // checksum addresses in every request
    this.app.use((req: any, res: any, next: any) => {
      // stateless
      if (req.body.address) {
        req.body.address = getAddress(req.body.address);
      }
      // session
      if (req.body.contracts) {
        req.body.contracts.forEach((contract: any) => {
          contract.address = getAddress(contract.address);
        });
      }
      if (req.query.addresses) {
        req.query.addresses = req.query.addresses
          .split(",")
          .map((address: string) => getAddress(address))
          .join(",");
      }
      next();
    });

    if (config.get("rateLimit.enabled")) {
      const limiter = rateLimit({
        windowMs: config.get("rateLimit.windowMs"),
        max: config.get("rateLimit.max"),
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: {
          error:
            "You are sending too many verification requests, please slow down.",
        },
        handler: (req, res, next, options) => {
          const ip = getIp(req);
          const ipHash = ip ? hash(ip) : "";
          const ipLog = process.env.NODE_ENV === "production" ? ipHash : ip; // Don't log IPs in production master
          const store = options.store as ExpressRateLimitMemoryStore;
          const hits = store.hits[ip || ""];
          logger.debug("Rate limit hit", {
            method: req.method,
            path: req.path,
            ip: ipLog,
            hits,
          });
          res.status(options.statusCode).send(options.message);
        },
        keyGenerator: (req: any) => {
          return getIp(req) || new Date().toISOString();
        },
        skip: (req) => {
          const ip = getIp(req);
          const whitelist = config.get("rateLimit.whitelist") as string[];
          for (const ipPrefix of whitelist) {
            if (ip?.startsWith(ipPrefix)) return true;
          }
          return false;
        },
      });

      this.app.all("/session/verify*", limiter);
      this.app.all("/verify*", limiter);
      this.app.post("/", limiter);
    }

    // Session API endpoints require non "*" origins because of the session cookies
    const sessionPaths = [
      "/session", // all paths /session/verify /session/input-files etc.
      // legacy endpoint naming below
      "/input-files",
      "/restart-session",
      "/verify-validated",
    ];
    this.app.use((req, res, next) => {
      // startsWith to match /session*
      if (sessionPaths.some((substr) => req.path.startsWith(substr))) {
        return cors({
          origin: config.get("corsAllowedOrigins"),
          credentials: true,
        })(req, res, next);
      }
      // * for all non-session paths
      return cors({
        origin: "*",
      })(req, res, next);
    });

    // Need this for secure cookies to work behind a proxy. See https://expressjs.com/en/guide/behind-proxies.html
    // true means the leftmost IP in the X-Forwarded-* header is used
    // Assuming the client ip is 2.2.2.2, reverse proxy 192.168.1.5
    // for the case "X-Forwarded-For: 2.2.2.2, 192.168.1.5", we want 2.2.2.2 to be used
    this.app.set("trust proxy", true);
    // Enable session only for session endpoints
    this.app.use("/*session*", getSessionMiddleware());

    this.app.use("/", routes);
    this.app.use(genericErrorHandler);
  }

  async listen(callback?: () => void) {
    const promisified: any = util.promisify(this.app.listen);
    await promisified(this.port);
    if (callback) callback();
  }

  // We need to resolve the $refs in the openapi file ourselves because the SwaggerUI-expresses does not do it
  async loadSwagger(root: string) {
    const options = {
      filter: ["relative", "remote"],
      loaderOptions: {
        processContent: function (res: any, callback: any) {
          callback(null, yamljs.parse(res.text));
        },
      },
      location: __dirname,
    };

    return resolveRefs(root as any, options).then(
      function (results: any) {
        return results.resolved;
      },
      function (err: any) {
        console.log(err.stack);
      },
    );
  }
}

if (require.main === module) {
  const server = new Server(config.get("server.port"), supportedChainsMap, {
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
  });

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
}

function hash(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getIp(req: Request) {
  if (req.headers["x-forwarded-for"]) {
    return req.headers["x-forwarded-for"].toString();
  }
  return req.ip;
}
