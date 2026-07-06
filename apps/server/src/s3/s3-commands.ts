import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { s3Client } from "./s3-client";
import { type MultipartUploadResult } from "./s3-types";

const bucketName = process.env.MINIO_BUCKET;

const DOWNLOAD_URL_EXPIRATION_SECONDS = 6 * 60 * 60; // 6 hours

type DurationParts = {
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

export function durationToSeconds(parts: DurationParts): number {
  return Math.floor(
    (parts.weeks ?? 0) * 7 * 24 * 60 * 60 +
      (parts.days ?? 0) * 24 * 60 * 60 +
      (parts.hours ?? 0) * 60 * 60 +
      (parts.minutes ?? 0) * 60 +
      (parts.seconds ?? 0)
  );
}

export const generateUploadUrl = async (
  fileRoute: string,
  contentType: string
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    ContentType: contentType,
    Key: fileRoute,
  });
  return getSignedUrl(s3Client, command, {
    expiresIn: durationToSeconds({ minutes: 10 }),
  });
};

export const generateDownloadUrl = async (fileRoute: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileRoute,
  });
  return getSignedUrl(s3Client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRATION_SECONDS,
  });
};

export const initiateMultipartUpload = async (
  fileRoute: string,
  contentType: string
): Promise<MultipartUploadResult> => {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    ContentType: contentType,
    Key: fileRoute,
  });
  const result = await s3Client.send(command);
  return {
    key: result.Key!,
    uploadId: result.UploadId!,
  };
};

export const generateChunkUploadUrl = async (
  fileRoute: string,
  uploadId: string,
  partNumber: number
): Promise<string> => {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: fileRoute,
    PartNumber: partNumber,
    UploadId: uploadId,
  });
  return getSignedUrl(s3Client, command, {
    expiresIn: durationToSeconds({ hours: 1 }),
  });
};

export const completeMultipartUpload = async (
  fileRoute: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<void> => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: fileRoute,
    MultipartUpload: {
      Parts: parts.map((part) => ({
        ETag: part.ETag,
        PartNumber: part.PartNumber,
      })),
    },
    UploadId: uploadId,
  });
  await s3Client.send(command);
};

export const abortMultipartUpload = async (fileRoute: string, uploadId: string): Promise<void> => {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: fileRoute,
    UploadId: uploadId,
  });
  await s3Client.send(command);
};

export const deleteObject = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  await s3Client.send(command);
};

export const headObject = async (key: string): Promise<boolean> => {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
};
