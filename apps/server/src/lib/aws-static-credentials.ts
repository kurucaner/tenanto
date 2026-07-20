export function awsStaticCredentials(): {
  accessKeyId: string;
  secretAccessKey: string;
} {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  };
}

export function minioStaticCredentials(): {
  accessKeyId: string;
  secretAccessKey: string;
} {
  return {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
  };
}
