import express from "express";
import serveIndex from "serve-index";
import fileUpload from "express-fileupload";
import cors from "cors";
import routes from "./routes";
import bodyParser from "body-parser";
import config from "../config";
import {
  getSourcifyChains,
  SourcifyEventManager,
} from "@ethereum-sourcify/core";
import genericErrorHandler from "./middlewares/GenericErrorHandler";
import notFoundHandler from "./middlewares/NotFoundError";
import useApiLogging from "./middlewares/ApiLogging";
import session from "express-session";
import createMemoryStore from "memorystore";
import util from "util";
const MemoryStore = createMemoryStore(session);

export class Server {
  app: express.Application;
  repository = config.repository.path;
  port = config.server.port;

  constructor() {
    useApiLogging(express);

    this.app = express();

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
    this.app.use(
      cors({
        origin: "*",
        // Allow follow-up middleware to override this CORS for options.
        // Session API endpoints require non "*" origins because of the session cookies
        preflightContinue: true,
      })
    );
    this.app.get("/health", (_req, res) =>
      res.status(200).send("Alive and kicking!")
    );
    this.app.get("/chains", (_req, res) => {
      const sourcifyChains = getSourcifyChains().map(({ rpc, ...rest }) => {
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
