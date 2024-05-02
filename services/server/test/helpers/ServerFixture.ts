import rimraf from "rimraf";
import { resetDatabase } from "../helpers/helpers";
import { StorageService } from "../../src/server/services/StorageService";
import { Server } from "../../src/server/server";
import config from "config";
import http from "http";
import { services } from "../../src/server/services/services";

export type ServerFixtureOptions = {
};

export class ServerFixture {
  private _storageService?: StorageService;
  private _server?: Server;

  // Getters for type safety
  // Can be safely accessed in "it" blocks
  get storageService(): StorageService {
    if (!this._storageService)
      throw new Error("storageService not initialized!");
    return this._storageService;
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
  constructor(options: ServerFixtureOptions = {}) {
    let httpServer: http.Server;

    before(async () => {
      process.env.SOURCIFY_POSTGRES_PORT =
        process.env.DOCKER_HOST_POSTGRES_TEST_PORT ||
        process.env.SOURCIFY_POSTGRES_PORT;

      if (
        !process.env.SOURCIFY_POSTGRES_HOST ||
        !process.env.SOURCIFY_POSTGRES_DB ||
        !process.env.SOURCIFY_POSTGRES_USER ||
        !process.env.SOURCIFY_POSTGRES_PASSWORD ||
        !process.env.SOURCIFY_POSTGRES_PORT
      ) {
        throw new Error("Not all required environment variables set");
      }
      this._storageService = new StorageService({
        repositoryV1ServiceOptions: {
          ipfsApi: process.env.IPFS_API || "",
          repositoryPath: config.get("repositoryV1.path"),
          repositoryServerUrl: config.get("repositoryV1.serverUrl"),
        },
        repositoryV2ServiceOptions: {
          ipfsApi: process.env.IPFS_API || "",
        },
        sourcifyDatabaseServiceOptions: {
          postgres: {
            host: process.env.SOURCIFY_POSTGRES_HOST,
            database: process.env.SOURCIFY_POSTGRES_DB,
            user: process.env.SOURCIFY_POSTGRES_USER,
            password: process.env.SOURCIFY_POSTGRES_PASSWORD,
            port: parseInt(process.env.SOURCIFY_POSTGRES_PORT),
          },
        },
      });

      services["initialize"]();
      this._server = new Server();
      await new Promise<void>((resolve, reject) => {
        httpServer = this.server.app.listen(this.server.port, resolve);
        httpServer.on("error", reject);
      });
      console.log(`Server listening on port ${this.server.port}!`);
    });

    beforeEach(async () => {
      rimraf.sync(this.server.repository);
      await resetDatabase(this.storageService);
    });

    after(() => {
      httpServer.close();
      rimraf.sync(this.server.repository);
    });
  }
}
