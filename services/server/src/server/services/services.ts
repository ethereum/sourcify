import { supportedChainsMap } from "../../sourcify-chains";
import { StorageService } from "./StorageService";
import { VerificationService } from "./VerificationService";
import config from "config";

export class Services {
  private _verification?: VerificationService;
  private _storage?: StorageService;

  constructor() {
    this.initialize();
  }

  // Getters for type safety
  get verification(): VerificationService {
    if (!this._verification) throw new Error("verification not initialized!");
    return this._verification;
  }
  get storage(): StorageService {
    if (!this._storage) throw new Error("storage not initialized!");
    return this._storage;
  }

  // This function allows for reloading the configuration parameters in the tests
  private initialize() {
    this._verification = new VerificationService(supportedChainsMap);
    this._storage = new StorageService({
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
  }
}

export const services = new Services();
