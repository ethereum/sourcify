import express from "express";
import serveIndex from "serve-index";
import cors from "cors";
import routes from "./routes";
import bodyParser from "body-parser";
import config, { etherscanAPIs } from "../config";
import { SourcifyEventManager } from "../common/SourcifyEventManager/SourcifyEventManager";
import "../common/SourcifyEventManager/listeners/matchStored";
import "../common/SourcifyEventManager/listeners/logger";
import genericErrorHandler from "./middlewares/GenericErrorHandler";
import notFoundHandler from "./middlewares/NotFoundError";
import useApiLogging from "./middlewares/ApiLogging";
import session from "express-session";
import createMemoryStore from "memorystore";
import util from "util";
import {
  checkChainId,
  checkSupportedChainId,
  sourcifyChainsArray,
} from "../sourcify-chains";
import { validateAddresses } from "./common";
import * as OpenApiValidator from "express-openapi-validator";
import swaggerUi from "swagger-ui-express";
import yamljs from "yamljs";
import { resolveRefs } from "json-refs";
import { initDeprecatedRoutes } from "./deprecated.routes";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fileUpload = require("express-fileupload");

const MemoryStore = createMemoryStore(session);

export class Server {
  app: express.Application;
  repository = config.repository.path;
  port: string | number;

  constructor(port?: string | number) {
    useApiLogging(express);
    this.port = port || config.server.port;
    this.app = express();

    this.app.use(
      bodyParser.urlencoded({
        limit: config.server.maxFileSize,
        extended: true,
      })
    );
    this.app.use(bodyParser.json({ limit: config.server.maxFileSize }));

    // Init deprecated routes before OpenApiValidator so that it can handle the request with the defined paths.
    // initDeprecatedRoutes is a middleware that replaces the deprecated paths with the real ones.
    initDeprecatedRoutes(this.app);

    this.app.use(
      fileUpload({
        limits: { fileSize: config.server.maxFileSize },
        abortOnLimit: true,
      })
    );

    // In every request support both chain and chainId
    this.app.use((req: any, res: any, next: any) => {
      if (req.body.chainId) {
        req.body.chain = req.body.chainId;
      }
      next();
    });

    this.app.use(
      OpenApiValidator.middleware({
        apiSpec: "openapi.yaml",
        validateRequests: true,
        validateResponses: false,
        ignoreUndocumented: true,
        fileUploader: false,
        serDes: [
          {
            format: "validate-addresses",
            deserialize: (addresses: string): string[] =>
              validateAddresses(addresses),
            serialize: (addresses: unknown): string => {
              return (addresses as string[]).join(",");
            },
          },
          {
            format: "supported-chains",
            deserialize: (chain: string) => checkSupportedChainId(chain),
            serialize: (chain: unknown): string => chain as string,
          },
          {
            format: "validate-supported-chains",
            deserialize: (chains: string) =>
              chains.split(",").map((chain) => checkChainId(chain)),
            serialize: (chain: unknown): string => chain as string,
          },
        ],
      })
    );

    this.app.use((err: any, req: any, res: any, next: any) => {
      // format error
      console.log(err);
      res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
      });
    });

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
          origin: config.corsAllowedOrigins,
          credentials: true,
        })(req, res, next);
      }
      // * for all non-session paths
      return cors({
        origin: "*",
      })(req, res, next);
    });

    // Need this for secure cookies to work behind a proxy. See https://expressjs.com/en/guide/behind-proxies.html
    // true means the leftmost IP in the X-Forwarded-* header is used.
    // Assuming the client ip is 2.2.2.2, reverse proxy 192.168.1.5
    // for the case "X-Forwarded-For: 2.2.2.2, 192.168.1.5", we want 2.2.2.2 to be used
    this.app.set("trust proxy", true);
    this.app.use(session(getSessionOptions()));

    this.app.get("/health", (_req, res) =>
      res.status(200).send("Alive and kicking!")
    );
    this.app.get("/chains", (_req, res) => {
      const sourcifyChains = sourcifyChainsArray.map(({ rpc, ...rest }) => {
        // Don't show Alchemy & Infura IDs
        rpc = rpc.map((url) => {
          if (url.includes("alchemy"))
            return url.replace(/\/[^/]*$/, "/{ALCHEMY_ID}");
          else if (url.includes("infura"))
            return url.replace(/\/[^/]*$/, "/{INFURA_ID}");
          else return url;
        });
        return {
          ...rest,
          rpc,
          etherscanAPI: etherscanAPIs[rest.chainId]?.apiURL,
        };
      });

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

  async loadSwagger(root: string) {
    const options = {
      filter: ["relative", "remote"],
      loaderOptions: {
        processContent: function (res: any, callback: any) {
          callback(null, yamljs.parse(res.text));
        },
      },
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
  return {
    secret: config.session.secret,
    name: "sourcify_vid",
    rolling: true,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: config.session.maxAge,
      secure: config.session.secure,
      sameSite: "lax",
    },
    store: new MemoryStore({
      checkPeriod: config.session.maxAge,
    }),
  };
}

if (require.main === module) {
  const server = new Server();
  server
    .loadSwagger(yamljs.load("openapi.yaml"))
    .then((swaggerDocument: any) => {
      server.app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument)
      );
      server.app.listen(server.port, () =>
        SourcifyEventManager.trigger("Server.Started", {
          port: server.port,
        })
      );
    });
}
