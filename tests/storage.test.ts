import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { productImageKey, keyFromUrl, publicUrl, isStorageConfigured } from "@/lib/storage";

const saved: Record<string, string | undefined> = {};
const VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"];

beforeAll(() => {
  for (const v of VARS) saved[v] = process.env[v];
  process.env.R2_ACCOUNT_ID = "acct";
  process.env.R2_ACCESS_KEY_ID = "akid";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET = "yardcart-product-images";
  process.env.R2_PUBLIC_BASE_URL = "https://pub-test.r2.dev";
});

afterAll(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

describe("productImageKey", () => {
  it("namespaces by yard and product with the given extension", () => {
    const key = productImageKey("yard1", "prod1", "webp");
    expect(key).toMatch(/^products\/yard1\/prod1-\d+\.webp$/);
  });
});

describe("publicUrl / keyFromUrl", () => {
  it("builds a public URL from a key", () => {
    expect(publicUrl("products/y/p-1.webp")).toBe("https://pub-test.r2.dev/products/y/p-1.webp");
  });

  it("round-trips a URL back to its key", () => {
    const key = "products/y/p-1.webp";
    expect(keyFromUrl(publicUrl(key))).toBe(key);
  });

  it("returns null for a URL that isn't in our bucket", () => {
    expect(keyFromUrl("https://example.com/whatever.webp")).toBeNull();
    expect(keyFromUrl("")).toBeNull();
  });
});

describe("isStorageConfigured", () => {
  it("is true when all five vars are present", () => {
    expect(isStorageConfigured()).toBe(true);
  });

  it("is false when a var is missing", () => {
    const prev = process.env.R2_BUCKET;
    delete process.env.R2_BUCKET;
    expect(isStorageConfigured()).toBe(false);
    process.env.R2_BUCKET = prev;
  });
});
