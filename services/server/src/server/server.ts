import path from "path";
// First env vars need to be loaded before config
import dotenv from "dotenv";
dotenv.config();
// Make sure config is relative to server.ts and not where the server is run from
process.env["NODE_CONFIG_DIR"] = path.resolve(__dirname, "..", "config");
import config from "config";
import express, { Request } from "express";
import serveIndex from "serve-index";
import cors from "cors";
import routes from "./routes";
import bodyParser from "body-parser";
import genericErrorHandler from "./middlewares/GenericErrorHandler";
import notFoundHandler from "./middlewares/NotFoundError";
import session from "express-session";
import createMemoryStore from "memorystore";
import util from "util";
import {
  checkSourcifyChainId,
  checkSupportedChainId,
  sourcifyChainsArray,
} from "../sourcify-chains";
import {
  validateAddresses,
  validateSingleAddress,
  validateSourcifyChainIds,
} from "./common";
import * as OpenApiValidator from "express-openapi-validator";
import swaggerUi from "swagger-ui-express";
import yamljs from "yamljs";
import { resolveRefs } from "json-refs";
import { initDeprecatedRoutes } from "./deprecated.routes";
import { getAddress } from "ethers";
import { logger } from "../common/logger";
import { setLibSourcifyLogger } from "@ethereum-sourcify/lib-sourcify";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fileUpload = require("express-fileupload");
import {
  MemoryStore as ExpressRateLimitMemoryStore,
  rateLimit,
} from "express-rate-limit";
import crypto from "crypto";

const MemoryStore = createMemoryStore(session);

// here we override the standard LibSourcify's Logger with a custom one
setLibSourcifyLogger({
  // No need to set again the logger level because it's set here
  logLevel: process.env.NODE_ENV === "production" ? 3 : 4,
  setLevel(level: number) {
    this.logLevel = level;
  },
  log(level, msg) {
    if (level <= this.logLevel) {
      switch (level) {
        case 1:
          logger.error({
            prefix: "LibSourcify",
            message: msg,
          });
          break;
        case 2:
          logger.warn({
            prefix: "LibSourcify",
            message: msg,
          });
          break;
        case 3:
          logger.info({
            prefix: "LibSourcify",
            message: msg,
          });
          break;
        case 4:
          logger.debug({
            prefix: "LibSourcify",
            message: msg,
          });
          break;
      }
    }
  },
});

export class Server {
  app: express.Application;
  repository: string = config.get("repository.path");
  port: string | number;

  constructor(port?: string | number) {
    // To print regexes in the logs
    Object.defineProperty(RegExp.prototype, "toJSON", {
      value: RegExp.prototype.toString,
    });

    logger.info(
      `Starting Sourcify Server with config ${JSON.stringify(config, null, 2)}`
    );
    this.port = port || config.get("server.port");
    logger.info(`Starting Sourcify Server on port ${this.port}`);
    this.app = express();

    this.app.use(
      bodyParser.urlencoded({
        limit: config.get("server.maxFileSize"),
        extended: true,
      })
    );
    this.app.use(bodyParser.json({ limit: config.get("server.maxFileSize") }));

    // Init deprecated routes before OpenApiValidator so that it can handle the request with the defined paths.
    // initDeprecatedRoutes is a middleware that replaces the deprecated paths with the real ones.
    initDeprecatedRoutes(this.app);

    this.app.use(
      fileUpload({
        limits: { fileSize: config.get("server.maxFileSize") },
        abortOnLimit: true,
      })
    );

    // Log all requests in debugging mode
    this.app.use((req, res, next) => {
      const contentType = req.headers["content-type"];
      if (contentType === "application/json") {
        logger.debug(
          `Request: ${req.method} ${req.path} chainId=${
            req.body.chainId || req.body.chain
          } address=${req.body.address}`
        );
        next();
      } else if (contentType && contentType.includes("multipart/form-data")) {
        logger.debug(
          `Request: ${req.method} ${req.path} (multipart) chainId=${
            req.body.chainId || req.body.chain
          } address=${req.body.address}`
        );
        next();
      } else {
        logger.debug(`Request: ${req.method} ${req.path}`);
        next();
      }
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
        validateRequests: true,
        validateResponses: false,
        ignoreUndocumented: true,
        fileUploader: false,
        validateSecurity: {
          handlers: {
            BearerAuth: async (req, scopes, schema) => {
              return true;
            },
          },
        },
        formats: [
          {
            name: "comma-separated-addresses",
            type: "string",
            validate: (addresses: string) => validateAddresses(addresses),
          },
          {
            name: "address",
            type: "string",
            validate: (address: string) => validateSingleAddress(address),
          },
          {
            name: "comma-separated-sourcify-chainIds",
            type: "string",
            validate: (chainIds: string) => validateSourcifyChainIds(chainIds),
          },
          {
            name: "supported-chainId",
            type: "string",
            validate: (chainId: string) => checkSupportedChainId(chainId),
          },
          {
            // "Sourcify chainIds" include the chains that are revoked verification support, but can have contracts in the repo.
            name: "sourcify-chainId",
            type: "string",
            validate: (chainId: string) => checkSourcifyChainId(chainId),
          },
          {
            name: "match-type",
            type: "string",
            validate: (matchType: string) =>
              matchType === "full_match" || matchType === "partial_match",
          },
        ],
      })
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
      if (req.params.address) {
        req.params.address = getAddress(req.params.address);
      }
      next();
    });

    if (config.get("rateLimit.enabled")) {
      const limiter = rateLimit({
        windowMs: 2 * 1000,
        max: 1, // Requests per windowMs
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: {
          error:
            "You are sending too many verification requests, please slow down.",
        },
        handler: (req, res, next, options) => {
          const ip = getIp(req);
          const ipHash = ip ? hash(ip) : "";
          const ipLog =
            process.env.NODE_ENV === "production" &&
            process.env.NODE_CONFIG_ENV === "master"
              ? ipHash
              : ip; // Don't log IPs in production master
          const store = options.store as ExpressRateLimitMemoryStore;
          const hits = store.hits[ip || ""];
          logger.info(
            `Rate limit hit method=${req.method} path=${req.path} ip=${ipLog} hits=${hits}`
          );
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
    this.app.use(session(getSessionOptions()));

    this.app.get("/health", (_req, res) =>
      res.status(200).send("Alive and kicking!")
    );
    this.app.get("/chains", (_req, res) => {
      const sourcifyChains = sourcifyChainsArray.map(
        ({ rpc, name, title, chainId, supported, etherscanApi }) => {
          // Don't publish providers
          // Don't show Alchemy & Infura IDs
          rpc = rpc.map((url) => {
            if (typeof url === "string") {
              if (url.includes("alchemy"))
                return url.replace(/\/[^/]*$/, "/{ALCHEMY_API_KEY}");
              else if (url.includes("infura"))
                return url.replace(/\/[^/]*$/, "/{INFURA_API_KEY}");
              else return url;
            } else {
              // FetchRequest
              return url.url;
            }
          });
          return {
            name,
            title,
            chainId,
            rpc,
            supported,
            etherscanAPI: etherscanApi?.apiURL, // Needed in the UI
          };
        }
      );

      res.status(200).json(sourcifyChains);
    });

    this.app.use(
      "/repository",
      express.static(this.repository),
      serveIndex(this.repository, { icons: true })
    );
    this.app.use("/", routes);
    this.app.use(genericErrorHandler);
    this.app.use(notFoundHandler);
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
      }
    );
  }
}

function getSessionOptions(): session.SessionOptions {
  if (config.get("session.secret") === "CHANGE_ME") {
    logger.warn(
      "The session secret is not set, please set it in the config file"
    );
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
    store: new MemoryStore({
      checkPeriod: config.get("session.maxAge"),
    }),
  };
}

if (require.main === module) {
  const server = new Server();
  server
    .loadSwagger(yamljs.load(path.join(__dirname, "..", "openapi.yaml"))) // load the openapi file with the $refs resolved
    .then((swaggerDocument: any) => {
      server.app.get("/api-docs/swagger.json", (req, res) =>
        res.json(swaggerDocument)
      );
      server.app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument, {
          customSiteTitle: "Sourcify API",
          customfavIcon: "https://sourcify.dev/favicon.ico",
        })
      );
      server.app.listen(server.port, () =>
        logger.info(`Server listening on port ${server.port}`)
      );
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
