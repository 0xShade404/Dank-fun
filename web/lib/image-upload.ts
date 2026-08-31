import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export class ImageUploadError extends Error {}

/**
 * Validates and saves an uploaded image to public/uploads, returning its public URL path.
 * Fine for this single-instance MVP; production should swap this for IPFS/Arweave + an
 * S3-compatible bucket (with resizing/moderation), per docs/ARCHITECTURE.md.
 */
export async function saveUploadedImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError("Image too large (max 3MB)");
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    throw new ImageUploadError("Unsupported image type (png/jpeg/gif/webp only)");
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return `/uploads/${filename}`;
}
