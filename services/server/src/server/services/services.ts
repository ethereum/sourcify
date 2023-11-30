import config from "../../config";
import { supportedChainsMap } from "../../sourcify-chains";
import { StorageService } from "./StorageService";
import { VerificationService } from "./VerificationService";

export const services = {
  verification: new VerificationService(supportedChainsMap),
  storage: new StorageService({
    ipfsRepositoryServiceOptions: {
      ipfsApi: process.env.IPFS_API as string,
      repositoryPath: config.repository.path,
      repositoryServerUrl: process.env.REPOSITORY_SERVER_URL as string,
      repositoryVersion: "0.1",
    },
    sourcifyDatabaseServiceOptions: {
      postgres: {
        host: process.env.SOURCIFY_POSTGRES_HOST as string,
        database: process.env.SOURCIFY_POSTGRES_DB as string,
        user: process.env.SOURCIFY_POSTGRES_USER as string,
        password: process.env.SOURCIFY_POSTGRES_PASSWORD as string,
        port: parseInt(process.env.SOURCIFY_POSTGRES_PORT || "0"),
      },
    },
  }),
};
