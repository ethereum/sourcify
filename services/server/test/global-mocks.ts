import { S3Client } from "@aws-sdk/client-s3";
import S3ClientMock, { testS3Bucket, testS3Path } from "./helpers/S3ClientMock";
import sinon from "sinon";
import fs from "fs";
import path from "path";

// Stub the S3Client class
const s3Clientstub = sinon.stub(S3Client);
s3Clientstub.prototype.send = function (command) {
  return new S3ClientMock(testS3Path, testS3Bucket).send(command);
};

// Create test S3 directory if it doesn't exist
try {
  fs.accessSync(path.join(testS3Path, testS3Bucket));
} catch {
  fs.mkdirSync(path.join(testS3Path, testS3Bucket), {
    recursive: true,
  });
}
