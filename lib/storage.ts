import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 is S3-compatible, so we drive it with the AWS S3 SDK pointed at the R2 endpoint.
 * Files are served publicly from R2_PUBLIC_BASE_URL (an r2.dev URL today, a custom domain later);
 * the app only ever stores that public URL on the product row.
 */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — product image storage is not configured.`);
  return v;
}

let cached: S3Client | null = null;
function client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cached;
}

/** True when all five R2 vars are present, so callers/UI can degrade gracefully when they aren't. */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL
  );
}

/** Public URL for a stored object key. */
export function publicUrl(key: string): string {
  return `${env("R2_PUBLIC_BASE_URL").replace(/\/+$/, "")}/${key}`;
}

/**
 * Object key for a product's image. Namespaced per yard so an account's images can be
 * bulk-removed by prefix, and stamped with time so a replaced image never collides in cache.
 */
export function productImageKey(yardId: string, productId: string, ext: string): string {
  return `products/${yardId}/${productId}-${Date.now()}.${ext}`;
}

/** Given a stored public URL, recover the object key (for deletes). Returns null if it isn't ours. */
export function keyFromUrl(url: string): string | null {
  if (!url) return null;
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (base && url.startsWith(base + "/")) return url.slice(base.length + 1);
  return null;
}

export async function uploadImage(key: string, body: Buffer, contentType: string): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: env("R2_BUCKET"),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return publicUrl(key);
}

/** Best-effort delete of a single object; never throws (a leaked blob is cheaper than a broken save). */
export async function deleteImage(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }));
  } catch {
    /* ignore — orphaned object costs fractions of a cent */
  }
}

/** Delete every object under a prefix (used to clean an account's images on teardown). Best-effort. */
export async function deleteByPrefix(prefix: string): Promise<void> {
  try {
    const bucket = env("R2_BUCKET");
    let token: string | undefined;
    do {
      const listed = await client().send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
      );
      const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
      if (keys.length > 0) {
        await client().send(
          new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } })
        );
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
  } catch {
    /* best-effort */
  }
}
