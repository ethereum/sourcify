import express from 'express';
import serveIndex from 'serve-index';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import routes from './routes';
import bodyParser from 'body-parser';
import config from '../config';
import { Logger, getSourcifyChains } from '@ethereum-sourcify/core';
import bunyan from 'bunyan';
import genericErrorHandler from './middlewares/GenericErrorHandler';
import notFoundHandler from './middlewares/NotFoundError';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import util from 'util';
const MemoryStore = createMemoryStore(session);

export const logger: bunyan = Logger("Server");
export class Server {

  app: express.Application;
  repository = config.repository.path;
  port = config.server.port;
  localChainUrl?: string;

  constructor() {
    if (config.testing) {
      this.localChainUrl = config.localchain.url;
    }

    this.app = express();

    // TODO: 52MB is the max file size - is this right?
    this.app.use(fileUpload({
      limits: { fileSize: 50 * 1024 * 1024 },
      abortOnLimit: true
    }))

    this.app.use(cors({
      origin: config.corsAllowedOrigins,
      credentials: true,
    }));
    this.app.use(bodyParser.json({limit: '2mb'}));
    this.app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));
    this.app.set('trust proxy', 1) // trust first proxy, required for secure cookies.
    this.app.use(session(getSessionOptions()));
    this.app.get('/health', (_req, res) => res.status(200).send('Alive and kicking!'))
    this.app.get('/chains', (_req, res) => {
      const sourcifyChains = getSourcifyChains();
      res.status(200).json(sourcifyChains)
    })
    this.app.use('/repository', express.static(this.repository), serveIndex(this.repository, {'icons': true}))
    this.app.use('/', routes);
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
      sameSite: "lax"
    },
    store: new MemoryStore({
      checkPeriod: config.session.maxAge
    }),
  };
}

if (require.main === module) {
  const server = new Server();
  server.app.listen(server.port, () => logger.info({loc: '[LISTEN]'}, `Injector listening on port ${server.port}!`))
}
