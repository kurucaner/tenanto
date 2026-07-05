import { createWriteStream } from "node:fs";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { DOWNLOAD_URL_EXPIRATION_HOURS } from "@/packages/shared";

import { s3Client } from "./s3-client";
import { MultipartUploadResult } from "./s3-types";

const bucketName = process.env.MINIO_BUCKET;

type DurationParts = {
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};
export function durationToSeconds(parts: DurationParts): number {
  const sec =
    (parts.weeks ?? 0) * 7 * 24 * 60 * 60 +
    (parts.days ?? 0) * 24 * 60 * 60 +
    (parts.hours ?? 0) * 60 * 60 +
    (parts.minutes ?? 0) * 60 +
    (parts.seconds ?? 0);
  return Math.floor(sec);
}

export const generateUploadUrl = async (
  fileRoute: string,
  contentType: string
): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      ContentType: contentType,
      Key: fileRoute,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: durationToSeconds({ minutes: 10 }),
    });
    return signedUrl;
  } catch (error) {
    console.error("Error generating upload URL:", error);
    throw error;
  }
};

export const generateDownloadUrl = async (fileRoute: string): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileRoute,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: durationToSeconds({ hours: DOWNLOAD_URL_EXPIRATION_HOURS }),
    });
    return signedUrl;
  } catch (error) {
    console.error("Error generating download URL:", error);
    throw error;
  }
};

/** Fetch whole object as UTF-8 text (for small manifests). */
export async function getObjectUtf8(key: string): Promise<{ body: string } | { notFound: true }> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const result = await s3Client.send(command);
    if (!result.Body) {
      return { notFound: true };
    }
    const body = await result.Body.transformToString();
    return { body };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "$metadata" in err &&
      typeof (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
        "number" &&
      (err as { $metadata: { httpStatusCode?: number } }).$metadata.httpStatusCode === 404
    ) {
      return { notFound: true };
    }
    const name =
      err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    if (name === "NoSuchKey" || name === "NotFound") {
      return { notFound: true };
    }
    console.error("Error reading S3 object:", err);
    throw err;
  }
};

// Direct upload to S3 (for thumbnail extraction service)
export const uploadToS3 = async (
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      ACL: "public-read", // Ensure segments are publicly accessible
      Body: body,
      Bucket: bucketName,
      ContentType: contentType,
      Key: key,
    });

    await s3Client.send(command);
    return `${process.env.MINIO_ENDPOINT}/${bucketName}/${key}`;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

// Multipart upload functions
export const initiateMultipartUpload = async (
  fileRoute: string,
  contentType: string
): Promise<MultipartUploadResult> => {
  try {
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
  } catch (error) {
    console.error("Error initiating multipart upload:", error);
    throw error;
  }
};

export const generateChunkUploadUrl = async (
  fileRoute: string,
  uploadId: string,
  partNumber: number
): Promise<string> => {
  try {
    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: fileRoute,
      PartNumber: partNumber,
      UploadId: uploadId,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: durationToSeconds({ hours: 1 }),
    });
    return signedUrl;
  } catch (error) {
    console.error("Error generating chunk upload URL:", error);
    throw error;
  }
};

export const completeMultipartUpload = async (
  fileRoute: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<any> => {
  try {
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

    const result = await s3Client.send(command);
    return result;
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    throw error;
  }
};

export const abortMultipartUpload = async (fileRoute: string, uploadId: string): Promise<void> => {
  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileRoute,
      UploadId: uploadId,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    throw error;
  }
};

export const deleteObject = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting S3 object:", error);
    throw error;
  }
};

/** Stream an entire S3 object to a local path (for FFmpeg input). */
export async function downloadObjectToFile(key: string, destPath: string): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const result = await s3Client.send(command);
  if (!result.Body) {
    throw new Error(`Empty S3 body for key: ${key}`);
  }
  await pipeline(result.Body as Readable, createWriteStream(destPath));
}

/**
 * Upload streaming artifacts with **no** public ACL (vault access stays presigned/API-only).
 */
export async function putVaultStreamingObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Body: body,
    Bucket: bucketName,
    ContentType: contentType,
    Key: key,
  });
  await s3Client.send(command);
}
