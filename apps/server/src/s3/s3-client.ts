import { S3Client } from "@aws-sdk/client-s3";

import { isProduction } from "../environment";

export const s3Client = new S3Client({
  credentials: {
    accessKeyId: isProduction ? process.env.AWS_ACCESS_KEY_ID : process.env.MINIO_ACCESS_KEY,
    secretAccessKey: isProduction
      ? process.env.AWS_SECRET_ACCESS_KEY
      : process.env.MINIO_SECRET_KEY,
  },
  endpoint: isProduction ? undefined : process.env.MINIO_ENDPOINT,
  forcePathStyle: true,
  region: process.env.AWS_REGION,
});
