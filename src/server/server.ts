import express from "express";
import serveIndex from "serve-index";
import fileUpload from "express-fileupload";
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
import { sourcifyChainsArray } from "../sourcify-chains";
const MemoryStore = createMemoryStore(session);

export class Server {
  app: express.Application;
  repository = config.repository.path;
  port: string | number;

  constructor(port?: string | number) {
    useApiLogging(express);
    this.port = port || config.server.port;
    this.app = express();

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

    this.app.use(
      fileUpload({
        limits: { fileSize: config.server.maxFileSize },
        abortOnLimit: true,
      })
    );

    this.app.use(bodyParser.json({ limit: config.server.maxFileSize }));
    this.app.use(
      bodyParser.urlencoded({
        limit: config.server.maxFileSize,
        extended: true,
      })
    );
    this.app.set("trust proxy", 1); // trust first proxy, required for secure cookies.
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
  server.app.listen(server.port, () =>
    SourcifyEventManager.trigger("Server.Started", {
      port: server.port,
    })
  );
}
