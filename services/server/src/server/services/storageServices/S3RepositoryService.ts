import { RepositoryV2Service } from "./RepositoryV2Service";
import { WStorageService } from "../StorageService";
import { WStorageIdentifiers } from "./identifiers";
import logger from "../../../common/logger";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { PathConfig } from "../../types";
import Path from "path";

export interface S3RepositoryServiceOptions {
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  endpoint?: string;
}

export class S3RepositoryService
  extends RepositoryV2Service
  implements WStorageService
{
  IDENTIFIER = WStorageIdentifiers.S3Repository;
  private s3: S3Client;
  private bucket: string;

  constructor(options: S3RepositoryServiceOptions) {
    super({ repositoryPath: "" });
    this.bucket = options.s3Bucket;
    this.s3 = new S3Client({
      region: options.s3Region,
      credentials: {
        accessKeyId: options.s3AccessKeyId,
        secretAccessKey: options.s3SecretAccessKey,
      },
      endpoint: options.endpoint,
    });
  }

  async deletePartialIfExists(chainId: string, address: string) {
    const prefix = Path.join("contracts", "partial_match", chainId, address);

    try {
      const listParams = {
        Bucket: this.bucket,
        Prefix: prefix,
      };

      const listedObjects = await this.s3.send(
        new ListObjectsV2Command(listParams),
      );

      if (!listedObjects.Contents?.length) {
        return;
      }

      const deleteParams = {
        Bucket: this.bucket,
        Delete: {
          Objects: listedObjects.Contents.filter(
            (obj): obj is { Key: string } => obj.Key !== undefined,
          ).map(({ Key }) => ({ Key })),
        },
      };

      await this.s3.send(new DeleteObjectsCommand(deleteParams));
    } catch (error) {
      logger.error("Failed to delete partial match from S3", { error, prefix });
      throw error;
    }
  }

  async save(path: PathConfig, content: string) {
    const filePath = this.generateRelativeFilePath(path);

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: filePath,
          Body: content,
        }),
      );
    } catch (error) {
      logger.error("Failed to store file to S3", { error });
      throw error;
    }
  }
}
