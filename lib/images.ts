import sharp, { type Sharp } from "sharp";

/** Reject anything larger than this before we even hand it to sharp (raw upload, pre-compression). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Longest edge we keep. Product cards never need more; keeps files tiny and pages fast. */
export const MAX_DIMENSION = 1200;

export type ProcessedImage = {
  buffer: Buffer;
  contentType: "image/webp";
  ext: "webp";
  width: number;
  height: number;
};

export class ImageError extends Error {}

/**
 * Normalize an uploaded product photo into a small, uniform WebP regardless of what the
 * yard's phone/camera produced: auto-orient from EXIF, downscale the longest edge to
 * MAX_DIMENSION (never upscale), strip metadata, and re-encode as WebP. Throws ImageError
 * on anything that isn't a decodable raster image.
 */
export async function processProductImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageError("The image file was empty.");
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new ImageError("Image is too large — please use one under 10 MB.");
  }

  let pipeline: Sharp;
  try {
    // rotate() with no args applies the EXIF orientation, then drops it.
    pipeline = sharp(input, { failOn: "error" }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      throw new ImageError("That file doesn't look like an image.");
    }
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError("Couldn't read that image — please upload a JPG, PNG, or WebP.");
  }

  const out = await pipeline
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: out.data,
    contentType: "image/webp",
    ext: "webp",
    width: out.info.width,
    height: out.info.height,
  };
}
