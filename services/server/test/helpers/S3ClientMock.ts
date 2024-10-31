import fs from "fs";
import path from "path";

export const testS3Path = "/tmp/s3repository-test";
export const testS3Bucket = "test-bucket";

export default class S3ClientMock {
  constructor(
    private testS3Path: string,
    private testS3Bucket: string,
  ) {}
  async send(command: unknown) {
    if ((command as any).constructor.name === "PutObjectCommand") {
      const filePath = path.join(
        this.testS3Path,
        this.testS3Bucket,
        (command as any).input.Key as string,
      );
      await fs.promises.mkdir(path.dirname(filePath), {
        recursive: true,
      });
      await fs.promises.writeFile(
        filePath,
        (command as any).input.Body as Buffer,
      );
      return {};
    } else if ((command as any).constructor.name === "DeleteObjectsCommand") {
      const objects = (command as any).input.Delete.Objects;
      for (const obj of objects) {
        const filePath = path.join(this.testS3Path, this.testS3Bucket, obj.Key);
        await fs.promises.rm(filePath, { force: true });
      }
      return {};
    } else if ((command as any).constructor.name === "ListObjectsV2Command") {
      const prefix = (command as any).input.Prefix || "";
      const dirPath = path.join(this.testS3Path, this.testS3Bucket, prefix);

      try {
        // For our use-case let's simplify by returning only metadata.json
        const metadataPath = path.join(dirPath, "metadata.json");
        const exists = await fs.promises
          .access(metadataPath)
          .then(() => true)
          .catch(() => false);
        const files = exists ? ["metadata.json"] : [];
        return {
          Contents: files.map((file) => ({
            Key: path.relative(
              path.join(this.testS3Path, this.testS3Bucket),
              path.join(dirPath, file),
            ),
          })),
        };
      } catch (error) {
        return { Contents: [] };
      }
    }
  }
}
