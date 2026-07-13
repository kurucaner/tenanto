import type { MultipartFile } from "@fastify/multipart";
import type { FastifyRequest } from "fastify";

export interface ICsvMultipartLimits {
  maxBytesPerFile: number;
  maxFiles: number;
}

function isBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  return sample.includes(0);
}

export async function readMultipartCsvFiles(
  request: FastifyRequest,
  limits: ICsvMultipartLimits
): Promise<{ error: string } | { files: Array<{ buffer: Buffer; fileName: string }> }> {
  const files: Array<{ buffer: Buffer; fileName: string }> = [];

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      continue;
    }

    const filePart = part as MultipartFile;
    if (files.length >= limits.maxFiles) {
      return { error: `At most ${limits.maxFiles} files are allowed` };
    }

    const fileName = filePart.filename.trim() || "upload.csv";
    if (!fileName.toLowerCase().endsWith(".csv")) {
      return { error: "Only .csv files are supported" };
    }

    const buffer = await filePart.toBuffer();
    if (buffer.length === 0) {
      return { error: `${fileName} is empty` };
    }
    if (buffer.length > limits.maxBytesPerFile) {
      return { error: `${fileName} exceeds the 1 MB file size limit` };
    }
    if (isBinaryContent(buffer)) {
      return { error: `${fileName} does not look like a text CSV file` };
    }

    files.push({ buffer, fileName });
  }

  if (files.length === 0) {
    return { error: "At least one CSV file is required" };
  }

  return { files };
}
