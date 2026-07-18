import { S3Client } from "@aws-sdk/client-s3";

import { awsStaticCredentials, minioStaticCredentials } from "../lib/aws-static-credentials";
import { isProduction } from "../lib/environment";

export const s3Client = new S3Client({
  credentials: isProduction ? awsStaticCredentials() : minioStaticCredentials(),
  endpoint: isProduction ? undefined : process.env.MINIO_ENDPOINT,
  forcePathStyle: true,
  region: process.env.AWS_REGION ?? process.env.MINIO_REGION ?? "us-east-1",
});
