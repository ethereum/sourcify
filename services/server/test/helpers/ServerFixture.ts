import rimraf from "rimraf";
import { resetDatabase } from "../helpers/helpers";
import { StorageService } from "../../src/server/services/StorageService";
import { Server } from "../../src/server/server";
import config from "config";
import http from "http";
import { SourcifyDatabaseService } from "../../src/server/services/storageServices/SourcifyDatabaseService";
import { supportedChainsMap } from "../../src/sourcify-chains";
import {
  RWStorageIdentifiers,
  StorageIdentifiers,
} from "../../src/server/services/storageServices/identifiers";

export type ServerFixtureOptions = {
  port: number;
  read: RWStorageIdentifiers;
  writeOrWarn: StorageIdentifiers[];
  writeOrErr: StorageIdentifiers[];
};

export class ServerFixture {
  identifier: StorageIdentifiers | undefined;
  readonly maxFileSize = config.get<number>("server.maxFileSize");

  private _sourcifyDatabase?: SourcifyDatabaseService;
  private _server?: Server;

  // Getters for type safety
  // Can be safely accessed in "it" blocks
  get sourcifyDatabase(): SourcifyDatabaseService {
    if (!this._sourcifyDatabase)
      throw new Error("storageService not initialized!");
    return this._sourcifyDatabase;
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
      const storageService = new StorageService({
        enabledServices: {
          read: config.get("storage.read"),
          writeOrWarn: config.get("storage.writeOrWarn"),
          writeOrErr: config.get("storage.writeOrErr"),
        },
        repositoryV1ServiceOptions: {
          ipfsApi: process.env.IPFS_API || "",
          repositoryPath: config.get("repositoryV1.path"),
          repositoryServerUrl: config.get("repositoryV1.serverUrl"),
        },
        repositoryV2ServiceOptions: {
          ipfsApi: process.env.IPFS_API || "",
          repositoryPath: config.get("repositoryV2.path"),
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

      await storageService.init();
      this._sourcifyDatabase = storageService.rwServices[
        RWStorageIdentifiers.SourcifyDatabase
      ] as SourcifyDatabaseService;

      this._server = new Server(options.port!, supportedChainsMap, {
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
      });

      await this._server.services.init();

      await new Promise<void>((resolve, reject) => {
        httpServer = this.server.app.listen(this.server.port, resolve);
        httpServer.on("error", reject);
      });
      console.log(`Server listening on port ${this.server.port}!`);
    });

    beforeEach(async () => {
      rimraf.sync(this.server.repository);
      rimraf.sync(this.server.repositoryV2);
      await resetDatabase(this.sourcifyDatabase);
      console.log("Resetting SourcifyDatabase");
    });

    after(() => {
      httpServer.close();
      rimraf.sync(this.server.repository);
      rimraf.sync(this.server.repositoryV2);
    });
  }
}
